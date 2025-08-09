import { type ChildProcess, spawn } from 'child_process';
import type { AgentTransport } from '../../interface/agent-transport.js';
import type { AgentRequest, AgentResponse } from '../../model/dispatch.js';
import type { StdioAgentConfig } from '../../model/agents.js';
import type { MCPHandling } from '../../interface/mcp-handling.js';
import type { JSONObject, JSONValue } from '../../model/types.js';
import { getAgentCallTimeout } from '../../utils/env-helper.js';

// Node.js globals for timeout handling
/* eslint-disable no-undef */
declare const setTimeout: (_callback: () => void, _ms: number) => NodeJS.Timeout;
declare const clearTimeout: (_id: NodeJS.Timeout) => void;
/* eslint-enable no-undef */

/**
 * JSON-RPC 2.0 request for agent dispatch
 */
interface AgentRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'dispatch';
  params: AgentRequest;
}

/**
 * JSON-RPC 2.0 response from agent
 */
interface AgentRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: AgentResponse;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * JSON-RPC 2.0 request from agent (MCP tool call)
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * Union type for JSON-RPC messages
 */
type JsonRpcMessage = AgentRpcResponse | JsonRpcRequest;

/**
 * Stdio transport implementation for agent communication using JSON-RPC
 * Communicates with agents using JSON-RPC 2.0 protocol over stdio
 * Maintains persistent process for multiple requests
 */
export class StdioAgentTransport implements AgentTransport {
  private readonly config: StdioAgentConfig;
  private readonly mcpService: MCPHandling | undefined;
  private process: ChildProcess | null = null;
  private buffer = '';
  private requestId = 1;
  private currentRequest: {
    id: string | number;
    resolve: (_response: AgentResponse) => void;
    reject: (_error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null = null;
  private processStarting = false;
  private processReady = false;
  private shuttingDown = false;
  private restartAttempts = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxRestartAttempts = 5;
  private readonly restartBaseDelayMs = 500;

  /**
   * Creates a new StdioAgentTransport instance
   * @param config - The stdio agent configuration
   * @param mcpService - Optional MCP service for handling tool calls
   */
  constructor(config: StdioAgentConfig, mcpService?: MCPHandling) {
    if (!config.command || typeof config.command !== 'string') {
      throw new Error('Agent command must be a non-empty string');
    }

    this.config = config;
    this.mcpService = mcpService;
  }

  /**
   * Call the agent via JSON-RPC stdio communication using persistent process
   * @param agentRequest - The request to send to the agent
   * @returns Promise that resolves to the agent's response
   * @throws Error if the process fails or returns invalid response
   */
  async dispatch(agentRequest: AgentRequest): Promise<AgentResponse> {
    console.log(
      `🚀 [StdioAgentTransport] Dispatching to agent: ${this.config.command} ${(this.config.args || []).join(' ')}`
    );

    if (this.currentRequest) {
      throw new Error('StdioAgentTransport is busy with another request');
    }

    // Ensure process is running
    await this.ensureProcess();

    return new Promise((resolve, reject) => {
      const currentRequestId = this.requestId++;

      // Set up timeout
      const timeoutMs = getAgentCallTimeout();
      const timeout = setTimeout(() => {
        if (this.currentRequest && this.currentRequest.id === currentRequestId) {
          this.currentRequest = null;
        }
        reject(new Error(`Agent call timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Store the single in-flight request
      this.currentRequest = {
        id: currentRequestId,
        resolve,
        reject,
        timeout,
      };

      // Send JSON-RPC request
      const rpcRequest: AgentRpcRequest = {
        jsonrpc: '2.0',
        id: currentRequestId,
        method: 'dispatch',
        params: agentRequest,
      };

      try {
        this.sendRpcRequest(rpcRequest);
      } catch (error) {
        if (this.currentRequest && this.currentRequest.id === currentRequestId) {
          clearTimeout(timeout);
          this.currentRequest = null;
        }
        reject(error);
      }
    });
  }

  /**
   * Ensure the agent process is running and ready
   */
  private async ensureProcess(): Promise<void> {
    if (this.processReady && this.process && !this.process.killed) {
      return;
    }

    if (this.processStarting) {
      // Wait for the current startup to complete
      while (this.processStarting) {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
      if (this.processReady) {
        return;
      }
    }

    await this.startProcess();
  }

  /**
   * Start the agent process and set up communication (persistent)
   */
  private async startProcess(): Promise<void> {
    if (this.processStarting) {
      return;
    }

    this.processStarting = true;
    this.processReady = false;

    return new Promise((resolve, reject) => {
      console.log(
        `🚀 [StdioAgentTransport] Starting persistent JSON-RPC agent: ${this.config.command} ${(this.config.args || []).join(' ')}`
      );

      this.process = spawn(this.config.command, this.config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
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
        console.warn(`⚠️ [StdioAgentTransport] Agent stderr:`, data.toString().trim());
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        console.log(
          `🔄 [StdioAgentTransport] Agent process exited with code ${code}, signal ${signal}`
        );

        this.processReady = false;
        this.processStarting = false;
        // Clear process reference to allow clean restart on next dispatch
        this.process = null;

        // Schedule auto-restart unless we're intentionally shutting down
        if (!this.shuttingDown) {
          this.scheduleRestart();
        }

        // Handle any remaining in-flight request
        if (this.currentRequest) {
          console.warn(`⚠️ [StdioAgentTransport] Process exited with 1 pending request`);

          // Reject all pending requests with appropriate error
          const exitError = new Error(
            `Agent process exited with code ${code}${signal ? `, signal ${signal}` : ''}`
          );

          clearTimeout(this.currentRequest.timeout);
          this.currentRequest.reject(exitError);
          this.currentRequest = null;
        } else {
          // Process exited cleanly with no pending requests
          if (code === 0) {
            console.log(`✅ [StdioAgentTransport] Agent process completed successfully`);
          } else {
            console.warn(
              `⚠️ [StdioAgentTransport] Agent process exited with non-zero code but no pending requests`
            );
          }
        }
      });

      // Handle process errors
      this.process.on('error', (error) => {
        console.error(`❌ [StdioAgentTransport] Agent process error:`, error);
        this.processStarting = false;
        this.processReady = false;
        // Clear process reference; next dispatch will attempt restart
        this.process = null;

        if (!this.shuttingDown) {
          this.scheduleRestart();
        }

        // Reject startup and any in-flight request
        reject(new Error(`Failed to spawn agent process: ${error.message}`));
        const processError = new Error(`Agent process error: ${error.message}`);
        if (this.currentRequest) {
          clearTimeout(this.currentRequest.timeout);
          this.currentRequest.reject(processError);
          this.currentRequest = null;
        }
      });

      // Process started successfully
      this.processStarting = false;
      this.processReady = true;
      // Reset restart state on successful start
      this.restartAttempts = 0;
      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
        this.restartTimer = null;
      }
      console.log(`✅ [StdioAgentTransport] Agent process started and ready`);
      resolve();
    });
  }

  /**
   * Schedule an automatic restart with exponential backoff.
   */
  private scheduleRestart(): void {
    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.warn(
        `⚠️ [StdioAgentTransport] Max restart attempts (${this.maxRestartAttempts}) reached; will restart on next dispatch.`
      );
      return;
    }

    const delay = Math.min(10000, this.restartBaseDelayMs * Math.pow(2, this.restartAttempts));
    this.restartAttempts += 1;
    console.log(
      `🔁 [StdioAgentTransport] Scheduling restart attempt #${this.restartAttempts} in ${delay}ms`
    );

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
    }

    this.restartTimer = setTimeout(() => {
      // Avoid racing if process already started elsewhere
      if (this.processReady || this.processStarting || this.shuttingDown) {
        return;
      }
      void this.startProcess().catch((err) => {
        console.warn(`⚠️ [StdioAgentTransport] Auto-restart failed: ${String(err)}`);
        // If it fails, another attempt will be scheduled on next exit/error
      });
    }, delay);
  }

  /**
   * Handle stdout data from the agent process
   * Processes line-delimited JSON-RPC messages (both requests and responses)
   */
  private handleStdoutData(data: string): void {
    this.buffer += data;

    // Process complete lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as JsonRpcMessage;

          // Check if it's a JSON-RPC message
          if (message.jsonrpc === '2.0') {
            if ('method' in message) {
              // It's a JSON-RPC request from agent (MCP tool call)
              void this.handleMcpRequest(message as JsonRpcRequest);
            } else if ('id' in message && message.id !== undefined) {
              // It's a JSON-RPC response to our dispatch request
              this.handleRpcResponse(message as AgentRpcResponse);
            } else {
              console.warn(`⚠️ [StdioAgentTransport] Invalid JSON-RPC message:`, line.trim());
            }
          } else {
            // Not a JSON-RPC message, ignore
            console.warn(`⚠️ [StdioAgentTransport] Ignoring non-JSON-RPC output:`, line.trim());
          }
        } catch {
          // Silently ignore lines that aren't valid JSON (like log messages)
          console.warn(`⚠️ [StdioAgentTransport] Ignoring non-JSON output:`, line.trim());
        }
      }
    }
  }

  /**
   * Handle JSON-RPC response from agent
   */
  private handleRpcResponse(rpcResponse: AgentRpcResponse): void {
    // Validate JSON-RPC response format
    if (rpcResponse.jsonrpc !== '2.0' || rpcResponse.id === undefined) {
      console.error(`❌ [StdioAgentTransport] Invalid JSON-RPC response format:`, rpcResponse);
      return;
    }

    const requestId = rpcResponse.id;
    const pendingRequest =
      this.currentRequest && this.currentRequest.id === requestId ? this.currentRequest : null;

    if (!pendingRequest) {
      console.warn(
        `⚠️ [StdioAgentTransport] Received response for unknown request ID: ${requestId}`
      );
      return;
    }

    // Clean up the pending request
    clearTimeout(pendingRequest.timeout);
    this.currentRequest = null;

    if (rpcResponse.error) {
      console.error(`❌ [StdioAgentTransport] Agent returned error:`, rpcResponse.error);
      pendingRequest.reject(new Error(`Agent error: ${rpcResponse.error.message}`));
      return;
    }

    if (rpcResponse.result) {
      try {
        this.validateAgentResponse(rpcResponse.result);
        console.log(`✅ [StdioAgentTransport] Agent responded successfully`);
        pendingRequest.resolve(rpcResponse.result);
      } catch (error) {
        console.error(`❌ [StdioAgentTransport] Invalid agent response:`, error);
        pendingRequest.reject(error as Error);
      }
    } else {
      console.error(`❌ [StdioAgentTransport] No result in JSON-RPC response:`, rpcResponse);
      pendingRequest.reject(new Error('No result in JSON-RPC response'));
    }
  }

  /**
   * Send a JSON-RPC request to the agent process
   */
  private sendRpcRequest(rpcRequest: AgentRpcRequest): void {
    if (!this.process?.stdin) {
      throw new Error('Agent process stdin not available');
    }

    const requestData = `${JSON.stringify(rpcRequest)}\n`;
    try {
      this.process.stdin.write(requestData, (error) => {
        if (error) {
          console.error(`❌ [StdioAgentTransport] Failed to send JSON-RPC request:`, error);
          // Reject in-flight request if it matches
          if (this.currentRequest && this.currentRequest.id === rpcRequest.id) {
            clearTimeout(this.currentRequest.timeout);
            this.currentRequest.reject(new Error(`Failed to send request: ${error.message}`));
            this.currentRequest = null;
          }
        }
      });
    } catch (error) {
      const errorMsg = `Failed to write to agent process: ${error}`;
      console.error(`❌ [StdioAgentTransport] Write error:`, errorMsg);
      // Reject in-flight request if it matches
      if (this.currentRequest && this.currentRequest.id === rpcRequest.id) {
        clearTimeout(this.currentRequest.timeout);
        this.currentRequest.reject(new Error(errorMsg));
        this.currentRequest = null;
      }
    }
  }

  /**
   * Handle JSON-RPC request from agent (MCP tool call)
   */
  private async handleMcpRequest(request: JsonRpcRequest): Promise<void> {
    try {
      console.log(`🔧 [StdioAgentTransport] Handling MCP request: ${request.method}`);

      let result: unknown;

      // Forward MCP requests to the appropriate service
      if (request.method === 'tools/call') {
        // Handle tool call through MCP service
        const params = request.params as { name: string; arguments: Record<string, unknown> };
        result = await this.handleToolCall(params.name, params.arguments);
      } else if (request.method === 'tools/list') {
        // Handle tools list through MCP service
        result = await this.handleToolsList();
      } else {
        throw new Error(`Unsupported MCP method: ${request.method}`);
      }

      // Send JSON-RPC response back to agent
      const response = {
        jsonrpc: '2.0' as const,
        id: request.id,
        result,
      };

      this.sendToAgent(JSON.stringify(response));
    } catch (error) {
      console.error(`❌ [StdioAgentTransport] MCP request failed:`, error);

      // Send JSON-RPC error response back to agent
      const errorResponse = {
        jsonrpc: '2.0' as const,
        id: request.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };

      this.sendToAgent(JSON.stringify(errorResponse));
    }
  }

  /**
   * Handle tool call by forwarding to MCP service
   */
  private async handleToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.mcpService) {
      return {
        success: false,
        error: 'No MCP service available for tool calls',
      };
    }

    try {
      // Create MCP request for tool call
      const mcpRequest = {
        jsonrpc: '2.0' as const,
        id: this.requestId++,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args as Record<string, JSONValue>,
        } as JSONObject,
      };

      // Forward to Cubicler's MCP service
      const mcpResponse = await this.mcpService.handleMCPRequest(mcpRequest);

      if (mcpResponse.error) {
        return {
          success: false,
          error: mcpResponse.error.message,
        };
      }

      return mcpResponse.result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool call failed',
      };
    }
  }

  /**
   * Handle tools list by forwarding to MCP service
   */
  private async handleToolsList(): Promise<unknown> {
    if (!this.mcpService) {
      return { tools: [] };
    }

    try {
      // Create MCP request for tools list
      const mcpRequest = {
        jsonrpc: '2.0' as const,
        id: this.requestId++,
        method: 'tools/list',
        params: {},
      };

      // Forward to Cubicler's MCP service
      const mcpResponse = await this.mcpService.handleMCPRequest(mcpRequest);

      if (mcpResponse.error) {
        return {
          success: false,
          error: mcpResponse.error.message,
          tools: [],
        };
      }

      return mcpResponse.result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tools list failed',
        tools: [],
      };
    }
  }

  /**
   * Send JSON-RPC message to agent via stdin
   */
  private sendToAgent(message: string): void {
    if (!this.process?.stdin) {
      throw new Error('Agent process stdin not available');
    }

    const messageData = `${message}\n`;
    this.process.stdin.write(messageData, (error) => {
      if (error) {
        console.error(`❌ [StdioAgentTransport] Failed to send message to agent:`, error);
      }
    });
  }

  /**
   * Clean up resources (only called when transport is being destroyed)
   */
  private cleanup(): void {
    this.shuttingDown = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    // Reject in-flight request if any
    const cleanupError = new Error('Agent transport is being cleaned up');
    if (this.currentRequest) {
      clearTimeout(this.currentRequest.timeout);
      this.currentRequest.reject(cleanupError);
      this.currentRequest = null;
    }

    // Close process
    if (this.process && !this.process.killed) {
      try {
        // Close stdin first to signal the agent to finish
        this.process.stdin?.end();

        // Give the process 5 seconds to shut down gracefully
        const gracefulTimeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            console.warn(
              `⚠️ [StdioAgentTransport] Force killing agent process after graceful shutdown timeout`
            );
            this.process.kill('SIGKILL');
          }
        }, 5000);

        // Send SIGTERM for graceful shutdown
        this.process.kill('SIGTERM');

        // Clear timeout when process exits
        this.process.on('exit', () => {
          clearTimeout(gracefulTimeout);
        });
      } catch (error) {
        console.warn(`⚠️ [StdioAgentTransport] Error during cleanup:`, error);
        // Force kill if graceful cleanup fails
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }
    }

    this.process = null;
    this.buffer = '';
    this.processReady = false;
    this.processStarting = false;
    this.shuttingDown = false;
  }

  /**
   * Destroy the transport and clean up resources
   * Called when the transport is no longer needed
   */
  destroy(): void {
    console.log(`🧹 [StdioAgentTransport] Destroying transport and cleaning up resources`);
    this.cleanup();
  }

  /**
   * Validate agent response format
   * @param agentResponse - Agent response to validate
   * @throws Error if response format is invalid
   */
  private validateAgentResponse(agentResponse: AgentResponse): void {
    if (
      !agentResponse.timestamp ||
      !agentResponse.type ||
      agentResponse.content === undefined ||
      !agentResponse.metadata
    ) {
      throw new Error(
        'Invalid agent response format: missing required fields (timestamp, type, content, metadata)'
      );
    }
  }
}
