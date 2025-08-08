import { type ChildProcess, spawn } from 'child_process';
import type { AgentTransport } from '../../interface/agent-transport.js';
import type { AgentRequest, AgentResponse } from '../../model/dispatch.js';
import type { StdioAgentConfig } from '../../model/agents.js';
import type { MCPRequest, MCPResponse } from '../../model/types.js';
import { getAgentCallTimeout } from '../../utils/env-helper.js';

// Node.js globals for timeout handling
/* eslint-disable no-undef */
declare const setTimeout: (_callback: () => void, _ms: number) => NodeJS.Timeout;
declare const clearTimeout: (_id: NodeJS.Timeout) => void;
/* eslint-enable no-undef */

/**
 * Message types for bidirectional stdio communication
 */
type StdioMessage =
  | { type: 'agent_request'; data: AgentRequest }
  | { type: 'agent_response'; data: AgentResponse }
  | { type: 'mcp_request'; id: string; data: MCPRequest }
  | { type: 'mcp_response'; id: string; data: MCPResponse };

/**
 * Bidirectional stdio transport implementation for agent communication
 * Supports both agent requests/responses and MCP calls from the agent back to Cubicler
 */
export class StdioAgentTransport implements AgentTransport {
  private readonly config: StdioAgentConfig;
  private process: ChildProcess | null = null;
  private buffer = '';
  private pendingMcpRequests = new Map<
    string,
    {
      resolve: (_response: MCPResponse) => void;
      reject: (_error: Error) => void;
      timeout: ReturnType<typeof globalThis.setTimeout>;
    }
  >();
  private agentResponseResolve: ((_response: AgentResponse) => void) | null = null;
  private agentResponseReject: ((_error: Error) => void) | null = null;

  /**
   * Creates a new StdioAgentTransport instance
   * @param config - The stdio agent configuration
   */
  constructor(config: StdioAgentConfig) {
    if (!config.command || typeof config.command !== 'string') {
      throw new Error('Agent command must be a non-empty string');
    }

    this.config = config;
  }

  /**
   * Call the agent via bidirectional stdio communication
   * @param agentRequest - The request to send to the agent
   * @returns Promise that resolves to the agent's response
   * @throws Error if the process fails or returns invalid response
   */
  async dispatch(agentRequest: AgentRequest): Promise<AgentResponse> {
    console.log(
      `🚀 [StdioAgentTransport] Starting bidirectional agent: ${this.config.command} ${(this.config.args || []).join(' ')}`
    );

    return new Promise((resolve, reject) => {
      this.agentResponseResolve = resolve;
      this.agentResponseReject = reject;

      // Start the agent process
      this.startProcess()
        .then(() => {
          // Send initial agent request
          this.sendMessage({ type: 'agent_request', data: agentRequest });

          // Set up overall timeout
          const timeoutMs = getAgentCallTimeout();
          const timeoutId = setTimeout(() => {
            this.cleanup();
            reject(new Error(`Agent call timeout after ${timeoutMs}ms`));
          }, timeoutMs);

          // Store timeout for cleanup
          this.pendingMcpRequests.set('__main_timeout__', {
            resolve: (() => {}) as (_response: MCPResponse) => void,
            reject,
            timeout: timeoutId,
          });
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

      // Handle stdout data (bidirectional messages)
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
   * Processes line-delimited JSON messages
   */
  private handleStdoutData(data: string): void {
    this.buffer += data;

    // Process complete lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as StdioMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error(`❌ [StdioAgentTransport] Failed to parse JSON message:`, line, error);
        }
      }
    }
  }

  /**
   * Handle parsed message from agent
   */
  private handleMessage(message: StdioMessage): void {
    switch (message.type) {
      case 'agent_response':
        this.handleAgentResponse(message.data);
        break;
      case 'mcp_request':
        this.handleMcpRequest(message.id, message.data);
        break;
      default:
        console.warn(`⚠️ [StdioAgentTransport] Unknown message type:`, message);
    }
  }

  /**
   * Handle final agent response
   */
  private handleAgentResponse(agentResponse: AgentResponse): void {
    try {
      this.validateAgentResponse(agentResponse);
      console.log(`✅ [StdioAgentTransport] Agent responded successfully`);

      if (this.agentResponseResolve) {
        this.agentResponseResolve(agentResponse);
      }
    } catch (error) {
      console.error(`❌ [StdioAgentTransport] Invalid agent response:`, error);
      if (this.agentResponseReject) {
        this.agentResponseReject(error as Error);
      }
    } finally {
      this.cleanup();
    }
  }

  /**
   * Handle MCP request from agent
   */
  private async handleMcpRequest(id: string, mcpRequest: MCPRequest): Promise<void> {
    console.log(`📡 [StdioAgentTransport] Handling MCP request ${id}: ${mcpRequest.method}`);

    try {
      // Get MCP service - in a real implementation, this would be injected
      // For now, we'll send an error response indicating MCP is not available
      const mcpResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        error: {
          code: -32601,
          message: 'MCP service not available in stdio transport',
          data: 'Use HTTP endpoint for MCP calls: POST /mcp',
        },
      };

      this.sendMessage({ type: 'mcp_response', id, data: mcpResponse });
    } catch (error) {
      console.error(`❌ [StdioAgentTransport] MCP request failed:`, error);

      const errorResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        error: {
          code: -32603,
          message: 'Internal error handling MCP request',
          data: (error as Error).message,
        },
      };

      this.sendMessage({ type: 'mcp_response', id, data: errorResponse });
    }
  }

  /**
   * Send a message to the agent process
   */
  private sendMessage(message: StdioMessage): void {
    if (!this.process?.stdin) {
      throw new Error('Agent process stdin not available');
    }

    const messageData = `${JSON.stringify(message)}\n`;
    try {
      this.process.stdin.write(messageData, (error) => {
        if (error) {
          console.error(`❌ [StdioAgentTransport] Failed to send message:`, error);
          if (this.agentResponseReject) {
            this.agentResponseReject(new Error(`Failed to send message: ${error.message}`));
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
   * Clean up resources
   */
  private cleanup(): void {
    // Clear all pending MCP requests
    for (const [id, pending] of this.pendingMcpRequests.entries()) {
      clearTimeout(pending.timeout);
      if (id !== '__main_timeout__') {
        pending.reject(new Error('Agent process terminated'));
      }
    }
    this.pendingMcpRequests.clear();

    // Close process
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
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
