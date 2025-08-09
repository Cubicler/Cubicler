import { type ChildProcess, spawn } from 'child_process';
import type { MCPRequest, MCPResponse } from '../../model/types.js';
import type { StdioMcpServerConfig } from '../../model/providers.js';
import type { MCPTransport } from '../../interface/mcp-transport.js';

/**
 * Stdio MCP Transport implementation
 * Handles MCP communication over stdio protocol using process spawning
 */
export class StdioMCPTransport implements MCPTransport {
  private serverId: string | null = null;
  private server: StdioMcpServerConfig | null = null;
  private process: ChildProcess | null = null;
  private processStarting = false;
  private shuttingDown = false;
  private restartAttempts = 0;
  private restartTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private readonly maxRestartAttempts = 5;
  private readonly restartBaseDelayMs = 500;
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
   * @param serverId - Server identifier
   * @param server - Server configuration
   */
  async initialize(serverId: string, server: StdioMcpServerConfig): Promise<void> {
    this.validateServerConfig(serverId, server);
    this.serverId = serverId;
    this.server = server;

    await this.startProcess();

    console.log(`✅ [StdioMCPTransport] Initialized stdio transport for ${serverId}`);
  }

  /**
   * Send a request to the MCP server via stdio
   * @param request - MCP request to send
   * @returns Promise that resolves to MCP response
   */
  async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.server) {
      throw new Error('Stdio transport not initialized');
    }

    // Ensure process is running
    if (!this.process || !this.process.stdin || this.process.killed) {
      await this.ensureProcess();
      if (!this.process || !this.process.stdin) {
        throw new Error(`Stdio process for ${this.serverId} is not available`);
      }
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
      console.log(`📡 [StdioMCPTransport] Sending request to ${this.serverId}:`, request.method);

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
    this.serverId = null;
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
    return this.serverId || 'unknown';
  }

  /**
   * Start the MCP server process
   */
  private async startProcess(): Promise<void> {
    if (this.processStarting || this.process) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.processStarting = true;
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
        this.processStarting = false;
        reject(new Error('Failed to create process streams'));
        return;
      }

      // Handle stdout data (JSON-RPC responses)
      this.process.stdout.on('data', (data: Buffer) => {
        this.handleStdoutData(data.toString());
      });

      // Handle stderr for logging
      this.process.stderr.on('data', (data: Buffer) => {
        console.warn(`⚠️ [StdioMCPTransport] ${this.serverId} stderr:`, data.toString().trim());
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        console.log(
          `🔄 [StdioMCPTransport] ${this.serverId} process exited with code ${code}, signal ${signal}`
        );
        this.cleanup();
        if (!this.shuttingDown) {
          this.scheduleRestart();
        }
      });

      // Handle process errors
      this.process.on('error', (error) => {
        console.error(`❌ [StdioMCPTransport] ${this.serverId} process error:`, error);
        this.cleanup();
        if (!this.shuttingDown) {
          this.scheduleRestart();
        }
        this.processStarting = false;
        reject(error);
      });

      // Wait a brief moment for the process to start
      globalThis.setTimeout(() => {
        if (this.process && !this.process.killed) {
          // Reset restart state on successful start
          this.restartAttempts = 0;
          if (this.restartTimer) {
            globalThis.clearTimeout(this.restartTimer);
            this.restartTimer = null;
          }
          this.processStarting = false;
          console.log(`✅ [StdioMCPTransport] ${this.serverId} started successfully`);
          resolve();
        } else {
          this.processStarting = false;
          reject(new Error(`Failed to start MCP server ${this.serverId}`));
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
      this.shuttingDown = true;
      if (this.restartTimer) {
        globalThis.clearTimeout(this.restartTimer);
        this.restartTimer = null;
      }
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
          console.warn(`⚠️ [StdioMCPTransport] Force killing ${this.serverId}`);
          this.process.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  /** Ensure process is running */
  private async ensureProcess(): Promise<void> {
    if (this.process && !this.process.killed && this.process.stdin) {
      return;
    }
    if (this.processStarting) {
      // Wait briefly for a concurrent start to finish
      await new Promise((r) => globalThis.setTimeout(r, 50));
      if (this.process && !this.process.killed && this.process.stdin) return;
    }
    await this.startProcess();
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
            `❌ [StdioMCPTransport] Failed to parse JSON response from ${this.serverId}:`,
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
        `✅ [StdioMCPTransport] Received response for ${this.serverId} request ${requestId}`
      );
      pending.resolve(response);
    } else {
      console.warn(
        `⚠️ [StdioMCPTransport] Received response for unknown request ${requestId} from ${this.serverId}`
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
      pending.reject(new Error(`Connection to ${this.serverId} was closed`));
    }
    this.pendingRequests.clear();

    this.process = null;
    this.buffer = '';
  }

  /** Schedule automatic restart with exponential backoff */
  private scheduleRestart(): void {
    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.warn(
        `⚠️ [StdioMCPTransport] Max restart attempts (${this.maxRestartAttempts}) reached for ${this.serverId}; will restart on next request.`
      );
      return;
    }

    const delay = Math.min(10000, this.restartBaseDelayMs * Math.pow(2, this.restartAttempts));
    this.restartAttempts += 1;
    console.log(
      `🔁 [StdioMCPTransport] Scheduling restart for ${this.serverId} in ${delay}ms (attempt #${this.restartAttempts})`
    );

    if (this.restartTimer) {
      globalThis.clearTimeout(this.restartTimer);
    }

    this.restartTimer = globalThis.setTimeout(() => {
      if (this.process || this.processStarting || this.shuttingDown) {
        return;
      }
      void this.startProcess().catch((err) => {
        console.warn(
          `⚠️ [StdioMCPTransport] Auto-restart failed for ${this.serverId}: ${String(err)}`
        );
      });
    }, delay);
  }

  /**
   * Validate server configuration for stdio transport
   * @param serverId - Server identifier
   * @param server - Server configuration to validate
   * @throws Error if configuration is invalid
   */
  private validateServerConfig(serverId: string, server: StdioMcpServerConfig): void {
    if (!server.command) {
      throw new Error(`Stdio transport requires command for server ${serverId}`);
    }

    if (typeof server.command !== 'string' || server.command.trim() === '') {
      throw new Error(`Invalid command for server ${serverId}: must be a non-empty string`);
    }

    if (server.args && !Array.isArray(server.args)) {
      throw new Error(`Invalid args for server ${serverId}: must be an array of strings`);
    }

    if (server.env && typeof server.env !== 'object') {
      throw new Error(`Invalid env for server ${serverId}: must be an object`);
    }
  }
}
