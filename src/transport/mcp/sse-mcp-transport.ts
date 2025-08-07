import type { MCPRequest, MCPResponse } from '../../model/types.js';
import type { MCPServer, ProviderJwtAuthConfig } from '../../model/providers.js';
import type { MCPTransport } from '../../interface/mcp-transport.js';
import { fetchWithDefaultTimeout } from '../../utils/fetch-helper.js';
import jwtHelper from '../../utils/jwt-helper.js';

/**
 * SSE MCP Transport implementation
 * Handles MCP communication over Server-Sent Events protocol
 * Uses POST for sending requests and SSE for receiving responses
 */
export class SseMCPTransport implements MCPTransport {
  private server: MCPServer | null = null;
  private eventSource: EventSource | null = null;
  private isInitialized = false;
  private readonly pendingRequests = new Map<
    string,
    {
      resolve: (_response: MCPResponse) => void;
      reject: (_error: Error) => void;
      timeout: ReturnType<typeof globalThis.setTimeout>;
    }
  >();
  private readonly requestTimeout = 30000; // 30 seconds

  /**
   * Initialize the SSE transport
   * @param server - Server configuration
   */
  async initialize(server: MCPServer): Promise<void> {
    this.validateServerConfig(server);
    this.server = server;

    await this.initializeEventSource();

    this.isInitialized = true;
    console.log(`✅ [SseMCPTransport] Initialized SSE transport for ${server.identifier}`);
  }

  /**
   * Send a request to the MCP server via HTTP POST and receive response via SSE
   * @param request - MCP request to send
   * @returns Promise that resolves to MCP response
   */
  async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.server || !this.isInitialized) {
      throw new Error('SSE transport not initialized');
    }

    if (!this.eventSource || this.eventSource.readyState !== 1) {
      // EventSource.OPEN = 1
      throw new Error(`SSE connection to ${this.server.identifier} is not open`);
    }

    return new Promise((resolve, reject) => {
      const requestId = String(request.id);

      // Set up timeout
      const timeout = globalThis.setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request ${requestId} timed out after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      console.log(
        `📡 [SseMCPTransport] Sending SSE request to ${this.server?.identifier}:`,
        request.method
      );

      // Send request via HTTP POST
      this.sendHttpRequest(request).catch((error) => {
        globalThis.clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(error);
      });
    });
  }

  /**
   * Close the SSE transport
   */
  async close(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests.entries()) {
      globalThis.clearTimeout(pending.timeout);
      pending.reject(new Error(`Connection to ${this.server?.identifier} was closed`));
    }
    this.pendingRequests.clear();

    this.isInitialized = false;
    this.server = null;
    console.log('🔄 [SseMCPTransport] SSE transport closed');
  }

  /**
   * Check if the transport is connected
   */
  isConnected(): boolean {
    return this.isInitialized && this.eventSource !== null && this.eventSource.readyState === 1; // EventSource.OPEN = 1
  }

  /**
   * Get the server identifier
   */
  getServerIdentifier(): string {
    return this.server?.identifier || 'unknown';
  }

  /**
   * Initialize EventSource connection for receiving responses
   */
  private async initializeEventSource(): Promise<void> {
    if (!this.server) {
      throw new Error('Server not configured');
    }

    return new Promise((resolve, reject) => {
      const sseUrl = this.getSseUrl();
      console.log(`🔄 [SseMCPTransport] Connecting to SSE endpoint: ${sseUrl}`);

      this.eventSource = new EventSource(sseUrl, {
        withCredentials: false,
      });

      // Handle successful connection
      this.eventSource.onopen = () => {
        console.log(`✅ [SseMCPTransport] SSE connection opened for ${this.server?.identifier}`);
        resolve();
      };

      // Handle messages (MCP responses)
      this.eventSource.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data) as MCPResponse;
          this.handleResponse(response);
        } catch (error) {
          console.error(
            `❌ [SseMCPTransport] Failed to parse SSE message from ${this.server?.identifier}:`,
            event.data,
            error
          );
        }
      };

      // Handle connection errors
      this.eventSource.onerror = (error) => {
        console.error(
          `❌ [SseMCPTransport] SSE connection error for ${this.server?.identifier}:`,
          error
        );
        if (this.eventSource?.readyState === 2) {
          // EventSource.CLOSED = 2
          reject(new Error(`Failed to establish SSE connection to ${this.server?.identifier}`));
        }
      };

      // Handle custom event types if needed
      this.eventSource.addEventListener('mcp-response', (event) => {
        try {
          const response = JSON.parse(event.data) as MCPResponse;
          this.handleResponse(response);
        } catch (error) {
          console.error(
            `❌ [SseMCPTransport] Failed to parse MCP response from ${this.server?.identifier}:`,
            event.data,
            error
          );
        }
      });
    });
  }

  /**
   * Send HTTP POST request for MCP request
   */
  private async sendHttpRequest(request: MCPRequest): Promise<void> {
    if (!this.server) {
      throw new Error('Server not configured');
    }

    const postUrl = this.getPostUrl();

    try {
      const headers = await this.buildHeaders();
      await fetchWithDefaultTimeout(postUrl, {
        method: 'POST',
        headers,
        data: request,
      });

      console.log(`✅ [SseMCPTransport] HTTP request sent to ${this.server.identifier}`);
    } catch (error) {
      console.error(
        `❌ [SseMCPTransport] Failed to send HTTP request to ${this.server.identifier}:`,
        error
      );
      throw new Error(
        `Failed to send SSE request: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle MCP response received via SSE
   */
  private handleResponse(response: MCPResponse): void {
    const requestId = String(response.id);
    const pending = this.pendingRequests.get(requestId);

    if (pending) {
      globalThis.clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);

      console.log(
        `✅ [SseMCPTransport] Received SSE response for ${this.server?.identifier} request ${requestId}`
      );
      pending.resolve(response);
    } else {
      console.warn(
        `⚠️ [SseMCPTransport] Received SSE response for unknown request ${requestId} from ${this.server?.identifier}`
      );
    }
  }

  /**
   * Get SSE endpoint URL for receiving responses
   */
  private getSseUrl(): string {
    if (!this.server?.config) {
      throw new Error('Server URL not configured');
    }

    // Assume SSE endpoint is at /sse or /events relative to base URL
    // This can be customized based on the specific MCP server implementation
    const config = this.server.config as { url: string };
    const baseUrl = config.url.replace(/\/$/, ''); // Remove trailing slash
    return `${baseUrl}/sse`;
  }

  /**
   * Get HTTP POST endpoint URL for sending requests
   */
  private getPostUrl(): string {
    const config = this.server?.config as { url: string };
    if (!config?.url) {
      throw new Error('Server URL not configured');
    }

    // Assume POST endpoint is at /mcp or the base URL
    // This can be customized based on the specific MCP server implementation
    if (!this.server?.config) {
      throw new Error('Server config not available');
    }
    const serverConfig = this.server.config as { url: string };
    const baseUrl = serverConfig.url.replace(/\/$/, ''); // Remove trailing slash
    return `${baseUrl}/mcp`;
  }

  /**
   * Build HTTP headers including JWT authentication if configured
   * @returns Promise that resolves to headers object
   * @throws Error if JWT token cannot be obtained
   */
  private async buildHeaders(): Promise<Record<string, string>> {
    if (!this.server) {
      throw new Error('Server not configured');
    }

    const config = this.server.config as {
      headers?: Record<string, string>;
      auth?: { type: 'jwt'; config: ProviderJwtAuthConfig };
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    if (config.auth?.type === 'jwt') {
      const token = await jwtHelper.getToken(config.auth.config);
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Validate server configuration for SSE transport
   * @param server - Server configuration to validate
   * @throws Error if configuration is invalid
   */
  private validateServerConfig(server: MCPServer): void {
    if (server.transport !== 'sse') {
      throw new Error(`Invalid transport for SSE transport: ${server.transport}`);
    }

    if (!server.config) {
      throw new Error(`SSE transport requires config for server ${server.identifier}`);
    }

    const config = server.config as { url?: string };
    if (!config.url) {
      throw new Error(`SSE transport requires URL for server ${server.identifier}`);
    }

    try {
      new URL(config.url);
    } catch {
      throw new Error(`Invalid URL for server ${server.identifier}: ${config.url}`);
    }
  }
}
