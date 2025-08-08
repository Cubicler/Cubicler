import type { MCPRequest, MCPResponse } from '../../model/types.js';
import type { HttpMcpServerConfig } from '../../model/providers.js';
import type { MCPTransport } from '../../interface/mcp-transport.js';
import { fetchWithDefaultTimeout } from '../../utils/fetch-helper.js';
import jwtHelper from '../../utils/jwt-helper.js';

/**
 * SSE MCP Transport implementation
 * Handles MCP communication over Server-Sent Events protocol
 * Uses POST for sending requests and SSE for receiving responses
 */
export class SseMCPTransport implements MCPTransport {
  private serverId: string | null = null;
  private server: HttpMcpServerConfig | null = null;
  private eventSource: EventSource | null = null;
  private isInitialized = false;
  private clientId: string = '';
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
   * @param serverId - Server identifier
   * @param server - Server configuration
   */
  async initialize(serverId: string, server: HttpMcpServerConfig): Promise<void> {
    this.validateServerConfig(serverId, server);
    this.serverId = serverId;
    this.server = server;

    // Stable clientId per instance
    this.clientId = `cubicler_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

    await this.initializeEventSource();

    this.isInitialized = true;
    console.log(`✅ [SseMCPTransport] Initialized SSE transport for ${serverId}`);
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
      throw new Error(`SSE connection to ${this.serverId} is not open`);
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

      console.log(`📡 [SseMCPTransport] Sending SSE request to ${this.serverId}:`, request.method);

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
      pending.reject(new Error(`Connection to ${this.serverId} was closed`));
    }
    this.pendingRequests.clear();

    this.isInitialized = false;
    this.serverId = null;
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
    return this.serverId || 'unknown';
  }

  /**
   * Initialize EventSource connection for receiving responses
   */
  private async initializeEventSource(): Promise<void> {
    if (!this.server) {
      throw new Error('Server not configured');
    }

    const sseUrl = this.getSseUrl();
    console.log(`🔄 [SseMCPTransport] Connecting to SSE endpoint: ${sseUrl}`);

    // Resolve EventSource constructor in Node and browser environments
    const ES: any = await this.resolveEventSourceCtor();

    return new Promise((resolve, reject) => {
      this.eventSource = new ES(sseUrl);
      const es = this.eventSource as unknown as EventSource;

      let opened = false;
      const connectTimeout = globalThis.setTimeout(() => {
        if (!opened) {
          try {
            es.close?.();
          } catch {
            // Intentionally ignore close errors during timeout cleanup
          }
          reject(new Error(`Failed to establish SSE connection to ${this.serverId} (timeout)`));
        }
      }, 2000);

      // Handle successful connection
      es.onopen = () => {
        opened = true;
        globalThis.clearTimeout(connectTimeout);
        console.log(`✅ [SseMCPTransport] SSE connection opened for ${this.serverId}`);
        resolve();
      };

      // Handle messages (MCP responses)
      es.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data) as MCPResponse;
          this.handleResponse(response);
        } catch (error) {
          console.error(
            `❌ [SseMCPTransport] Failed to parse SSE message from ${this.serverId}:`,
            event.data,
            error
          );
        }
      };

      // Handle connection errors
      es.onerror = (error) => {
        console.error(`❌ [SseMCPTransport] SSE connection error for ${this.serverId}:`, error);
        if (!opened) {
          // Treat initial connection error as a failure and allow fallback
          globalThis.clearTimeout(connectTimeout);
          try {
            es.close?.();
          } catch {
            // Intentionally ignore close errors during timeout cleanup
          }
          reject(new Error(`Failed to establish SSE connection to ${this.serverId}`));
          return;
        }
      };

      // Handle custom event types if needed
      es.addEventListener('mcp-response', (event) => {
        try {
          const response = JSON.parse(event.data) as MCPResponse;
          this.handleResponse(response);
        } catch (error) {
          console.error(
            `❌ [SseMCPTransport] Failed to parse MCP response from ${this.serverId}:`,
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
      // Correlate POST with SSE stream
      headers['x-mcp-client-id'] = this.clientId;
      await fetchWithDefaultTimeout(postUrl, {
        method: 'POST',
        headers,
        data: request,
      });

      console.log(`✅ [SseMCPTransport] HTTP request sent to ${this.serverId}`);
    } catch (error) {
      console.error(`❌ [SseMCPTransport] Failed to send HTTP request to ${this.serverId}:`, error);
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
        `✅ [SseMCPTransport] Received SSE response for ${this.serverId} request ${requestId}`
      );
      pending.resolve(response);
    } else {
      console.warn(
        `⚠️ [SseMCPTransport] Received SSE response for unknown request ${requestId} from ${this.serverId}`
      );
    }
  }

  /**
   * Get SSE endpoint URL for receiving responses
   */
  private getSseUrl(): string {
    if (!this.server?.url) {
      throw new Error('Server URL not configured');
    }

    // Use dedicated MCP SSE endpoint: /mcp/sse and include clientId and optional token
    const baseUrl = this.server.url.replace(/\/$/, ''); // Remove trailing slash
    const url = new URL(`${baseUrl}/mcp/sse`);
    url.searchParams.set('clientId', this.clientId);
    const token = this.getJwtTokenSyncHint();
    if (token) {
      url.searchParams.set('token', token);
    }
    return url.toString();
  }

  /**
   * Get HTTP POST endpoint URL for sending requests
   */
  private getPostUrl(): string {
    if (!this.server?.url) {
      throw new Error('Server URL not configured');
    }

    const baseUrl = this.server.url.replace(/\/$/, ''); // Remove trailing slash
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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.server.headers,
    };

    if (this.server.auth?.type === 'jwt') {
      const token = await jwtHelper.getToken(this.server.auth.config);
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  /** Resolve EventSource constructor for both ESM and CJS environments. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async resolveEventSourceCtor(): Promise<any> {
    const globalES = (globalThis as any).EventSource;
    if (globalES) return globalES;

    try {
      const mod: any = await import('eventsource');
      const ctor = mod?.default ?? mod?.EventSource ?? mod;
      if (typeof ctor !== 'function') {
        throw new Error('Invalid EventSource export shape');
      }
      return ctor;
    } catch {
      throw new Error(
        'EventSource is not available. Install the "eventsource" package or provide a global EventSource.'
      );
    }
  }

  /** Best-effort token hint for SSE query (static tokens only). */
  private getJwtTokenSyncHint(): string | null {
    const auth = this.server?.auth;
    if (auth?.type === 'jwt' && auth.config.token) {
      return auth.config.token;
    }
    return null;
  }

  /**
   * Validate server configuration for SSE transport
   * @param serverId - Server identifier
   * @param server - Server configuration to validate
   * @throws Error if configuration is invalid
   */
  private validateServerConfig(serverId: string, server: HttpMcpServerConfig): void {
    if (!server.url) {
      throw new Error(`SSE transport requires URL for server ${serverId}`);
    }

    try {
      new URL(server.url);
    } catch {
      throw new Error(`Invalid URL for server ${serverId}: ${server.url}`);
    }
  }
}
