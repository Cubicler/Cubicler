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
 */
export class StdioAgentTransport implements AgentTransport {
  private readonly config: StdioAgentConfig;
  private readonly mcpService: MCPHandling | undefined;
  private process: ChildProcess | null = null;
  private buffer = '';
  private agentResponseResolve: ((_response: AgentResponse) => void) | null = null;
  private agentResponseReject: ((_error: Error) => void) | null = null;
  private requestId = 1;

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
   * Call the agent via JSON-RPC stdio communication
   * @param agentRequest - The request to send to the agent
   * @returns Promise that resolves to the agent's response
   * @throws Error if the process fails or returns invalid response
   */
  async dispatch(agentRequest: AgentRequest): Promise<AgentResponse> {
    console.log(
      `🚀 [StdioAgentTransport] Starting JSON-RPC agent: ${this.config.command} ${(this.config.args || []).join(' ')}`
    );

    return new Promise((resolve, reject) => {
      this.agentResponseResolve = resolve;
      this.agentResponseReject = reject;

      // Start the agent process
      this.startProcess()
        .then(() => {
          // Send JSON-RPC request
          const rpcRequest: AgentRpcRequest = {
            jsonrpc: '2.0',
            id: this.requestId++,
            method: 'dispatch',
            params: agentRequest,
          };

          this.sendRpcRequest(rpcRequest);

          // Set up overall timeout
          const timeoutMs = getAgentCallTimeout();
          const timeoutId = setTimeout(() => {
            this.cleanup();
            reject(new Error(`Agent call timeout after ${timeoutMs}ms`));
          }, timeoutMs);

          // Clean up timeout when done
          const originalResolve = this.agentResponseResolve;
          const originalReject = this.agentResponseReject;

          this.agentResponseResolve = (response: AgentResponse) => {
            clearTimeout(timeoutId);
            originalResolve?.(response);
          };

          this.agentResponseReject = (error: Error) => {
            clearTimeout(timeoutId);
            originalReject?.(error);
          };
        })
        .catch(reject);
    });
  }

  /**
   * Start the agent process and set up communication
   */
  private async startProcess(): Promise<void> {
    if (this.process) {
      throw new Error('Agent process is already running');
    }

    return new Promise((resolve, reject) => {
      this.process = spawn(this.config.command, this.config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
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
        console.warn(`⚠️ [StdioAgentTransport] Agent stderr:`, data.toString().trim());
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        console.log(
          `🔄 [StdioAgentTransport] Agent process exited with code ${code}, signal ${signal}`
        );
        if (code !== 0 && this.agentResponseReject) {
          const errorMessage = `Agent process exited with code ${code}${signal ? `, signal ${signal}` : ''}`;
          this.agentResponseReject(new Error(errorMessage));
        }
        this.cleanup();
      });

      // Handle process errors
      this.process.on('error', (error) => {
        console.error(`❌ [StdioAgentTransport] Agent process error:`, error);
        if (this.agentResponseReject) {
          this.agentResponseReject(new Error(`Failed to spawn agent process: ${error.message}`));
        }
        this.cleanup();
      });

      // Process started successfully
      console.log(`✅ [StdioAgentTransport] Agent process started`);
      resolve();
    });
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
      if (this.agentResponseReject) {
        this.agentResponseReject(new Error('Invalid JSON-RPC response format'));
      }
      return;
    }

    if (rpcResponse.error) {
      console.error(`❌ [StdioAgentTransport] Agent returned error:`, rpcResponse.error);
      if (this.agentResponseReject) {
        this.agentResponseReject(new Error(`Agent error: ${rpcResponse.error.message}`));
      }
      return;
    }

    if (rpcResponse.result) {
      try {
        this.validateAgentResponse(rpcResponse.result);
        console.log(`✅ [StdioAgentTransport] Agent responded successfully`);
        if (this.agentResponseResolve) {
          this.agentResponseResolve(rpcResponse.result);
        }
      } catch (error) {
        console.error(`❌ [StdioAgentTransport] Invalid agent response:`, error);
        if (this.agentResponseReject) {
          this.agentResponseReject(error as Error);
        }
      } finally {
        this.cleanup();
      }
    } else {
      console.error(`❌ [StdioAgentTransport] No result in JSON-RPC response:`, rpcResponse);
      if (this.agentResponseReject) {
        this.agentResponseReject(new Error('No result in JSON-RPC response'));
      }
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
          if (this.agentResponseReject) {
            this.agentResponseReject(new Error(`Failed to send request: ${error.message}`));
          }
        }
      });
    } catch (error) {
      const errorMsg = `Failed to write to agent process: ${error}`;
      console.error(`❌ [StdioAgentTransport] Write error:`, errorMsg);
      if (this.agentResponseReject) {
        this.agentResponseReject(new Error(errorMsg));
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
   * Clean up resources
   */
  private cleanup(): void {
    // Close process
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      // Force kill after 2 seconds
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 2000);
    }

    this.process = null;
    this.buffer = '';
    this.agentResponseResolve = null;
    this.agentResponseReject = null;
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
