import { type ChildProcess, spawn } from 'child_process';
import type { MCPRequest, MCPResponse } from '../../model/types.js';
import type { MCPServer } from '../../model/providers.js';
import type { MCPTransport } from '../../interface/mcp-transport.js';

/**
 * Stdio MCP Transport implementation
 * Handles MCP communication over stdio protocol using process spawning
 */
export class StdioMCPTransport implements MCPTransport {
  private server: MCPServer | null = null;
  private process: ChildProcess | null = null;
  private readonly pendingRequests = new Map<
    string,
    {
      resolve: (_response: MCPResponse) => void;
      reject: (_error: Error) => void;
      timeout: ReturnType<typeof globalThis.setTimeout>;
    }
  >();
  private buffer = '';
  private readonly requestTimeout = 30000; // 30 seconds

  /**
   * Initialize the stdio transport
   * @param server - Server configuration
   */
  async initialize(server: MCPServer): Promise<void> {
    this.validateServerConfig(server);
    this.server = server;

    await this.startProcess();

    console.log(`✅ [StdioMCPTransport] Initialized stdio transport for ${server.identifier}`);
  }

  /**
   * Send a request to the MCP server via stdio
   * @param request - MCP request to send
   * @returns Promise that resolves to MCP response
   */
  async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.process || !this.server) {
      throw new Error('Stdio transport not initialized');
    }

    if (!this.process.stdin) {
      throw new Error(`Stdio process for ${this.server.identifier} has no stdin`);
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

      // Send request
      const requestData = `${JSON.stringify(request)}\n`;
      console.log(
        `📡 [StdioMCPTransport] Sending request to ${this.server?.identifier}:`,
        request.method
      );

      if (this.process?.stdin) {
        this.process.stdin.write(requestData, (error) => {
          if (error) {
            globalThis.clearTimeout(timeout);
            this.pendingRequests.delete(requestId);
            reject(new Error(`Failed to send request: ${error.message}`));
          }
        });
      } else {
        globalThis.clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(new Error('Process stdin not available'));
      }
    });
  }

  /**
   * Close the stdio transport
   */
  async close(): Promise<void> {
    if (this.process) {
      await this.stopProcess();
    }
    this.server = null;
    console.log('🔄 [StdioMCPTransport] Stdio transport closed');
  }

  /**
   * Check if the transport is connected
   */
  isConnected(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Get the server identifier
   */
  getServerIdentifier(): string {
    return this.server?.identifier || 'unknown';
  }

  /**
   * Start the MCP server process
   */
  private async startProcess(): Promise<void> {
    if (this.process) {
      throw new Error(`MCP server ${this.server?.identifier} is already running`);
    }

    return new Promise((resolve, reject) => {
      if (!this.server) {
        reject(new Error('Server not initialized'));
        return;
      }
      const server = this.server;
      console.log(
        `🔄 [StdioMCPTransport] Starting MCP server: ${server.command} ${(server.args || []).join(' ')}`
      );

      if (!server.command) {
        reject(new Error('Server command not specified'));
        return;
      }
      this.process = spawn(server.command, server.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: server.cwd,
        env: { ...process.env, ...server.env },
      });

      if (!this.process.stdout || !this.process.stdin || !this.process.stderr) {
        reject(new Error('Failed to create process streams'));
        return;
      }

      // Handle stdout data (JSON-RPC responses)
      this.process.stdout.on('data', (data: Buffer) => {
        this.handleStdoutData(data.toString());
      });

      // Handle stderr for logging
      this.process.stderr.on('data', (data: Buffer) => {
        console.warn(`⚠️ [StdioMCPTransport] ${server.identifier} stderr:`, data.toString().trim());
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        console.log(
          `🔄 [StdioMCPTransport] ${server.identifier} process exited with code ${code}, signal ${signal}`
        );
        this.cleanup();
      });

      // Handle process errors
      this.process.on('error', (error) => {
        console.error(`❌ [StdioMCPTransport] ${server.identifier} process error:`, error);
        this.cleanup();
        reject(error);
      });

      // Wait a brief moment for the process to start
      globalThis.setTimeout(() => {
        if (this.process && !this.process.killed) {
          console.log(`✅ [StdioMCPTransport] ${server.identifier} started successfully`);
          resolve();
        } else {
          reject(new Error(`Failed to start MCP server ${server.identifier}`));
        }
      }, 100);
    });
  }

  /**
   * Stop the MCP server process
   */
  private async stopProcess(): Promise<void> {
    if (!this.process) {
      return;
    }

    return new Promise((resolve) => {
      const cleanup = () => {
        this.cleanup();
        resolve();
      };

      if (!this.process || this.process.killed) {
        cleanup();
        return;
      }

      this.process.on('exit', cleanup);

      // Try graceful termination first
      this.process.kill('SIGTERM');

      // Force kill after 5 seconds
      globalThis.setTimeout(() => {
        if (this.process && !this.process.killed) {
          console.warn(`⚠️ [StdioMCPTransport] Force killing ${this.server?.identifier}`);
          this.process.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  /**
   * Handle stdout data from the MCP server
   * Processes line-delimited JSON responses
   */
  private handleStdoutData(data: string): void {
    this.buffer += data;

    // Process complete lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line) as MCPResponse;
          this.handleResponse(response);
        } catch (error) {
          console.error(
            `❌ [StdioMCPTransport] Failed to parse JSON response from ${this.server?.identifier}:`,
            line,
            error
          );
        }
      }
    }
  }

  /**
   * Handle parsed MCP response
   */
  private handleResponse(response: MCPResponse): void {
    const requestId = String(response.id);
    const pending = this.pendingRequests.get(requestId);

    if (pending) {
      globalThis.clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);

      console.log(
        `✅ [StdioMCPTransport] Received response for ${this.server?.identifier} request ${requestId}`
      );
      pending.resolve(response);
    } else {
      console.warn(
        `⚠️ [StdioMCPTransport] Received response for unknown request ${requestId} from ${this.server?.identifier}`
      );
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Reject all pending requests
    for (const [, pending] of this.pendingRequests.entries()) {
      globalThis.clearTimeout(pending.timeout);
      pending.reject(new Error(`Connection to ${this.server?.identifier} was closed`));
    }
    this.pendingRequests.clear();

    this.process = null;
    this.buffer = '';
  }

  /**
   * Validate server configuration for stdio transport
   * @param server - Server configuration to validate
   * @throws Error if configuration is invalid
   */
  private validateServerConfig(server: MCPServer): void {
    if (server.transport !== 'stdio') {
      throw new Error(`Invalid transport for stdio transport: ${server.transport}`);
    }

    if (!server.command) {
      throw new Error(`Stdio transport requires command for server ${server.identifier}`);
    }

    if (typeof server.command !== 'string' || server.command.trim() === '') {
      throw new Error(
        `Invalid command for server ${server.identifier}: must be a non-empty string`
      );
    }

    if (server.args && !Array.isArray(server.args)) {
      throw new Error(`Invalid args for server ${server.identifier}: must be an array of strings`);
    }

    if (server.env && typeof server.env !== 'object') {
      throw new Error(`Invalid env for server ${server.identifier}: must be an object`);
    }
  }
}
