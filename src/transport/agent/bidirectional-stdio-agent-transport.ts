import { type ChildProcess, spawn } from 'child_process';
import type { AgentTransport } from '../../interface/agent-transport.js';
import type { AgentRequest, AgentResponse } from '../../model/dispatch.js';
import type { StdioAgentConfig } from '../../model/agents.js';
import type { MCPRequest, MCPResponse } from '../../model/types.js';
import type { MCPHandling } from '../../interface/mcp-handling.js';
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
  | { type: 'mcp_response'; id: string; data: MCPResponse }
  | { type: 'error'; id?: string; message: string };

/**
 * Bidirectional stdio transport implementation for agent communication
 * Supports both agent calls and MCP callbacks over the same stdio connection
 */
export class BidirectionalStdioAgentTransport implements AgentTransport {
  private readonly config: StdioAgentConfig;
  private readonly mcpService: MCPHandling;
  private process: ChildProcess | null = null;
  private buffer = '';
  private readonly pendingMcpRequests = new Map<
    string,
    {
      resolve: (_response: MCPResponse) => void;
      reject: (_error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private agentResponseResolver: ((_response: AgentResponse) => void) | null = null;
  private agentResponseRejecter: ((_error: Error) => void) | null = null;

  /**
   * Creates a new BidirectionalStdioAgentTransport instance
   * @param config - The stdio agent configuration
   * @param mcpService - The MCP service for handling MCP requests
   */
  constructor(config: StdioAgentConfig, mcpService: MCPHandling) {
    if (!config.command || typeof config.command !== 'string') {
      throw new Error('Agent command must be a non-empty string');
    }

    this.config = config;
    this.mcpService = mcpService;
  }

  /**
   * Call the agent via bidirectional stdio communication
   * @param agentRequest - The request to send to the agent
   * @returns Promise that resolves to the agent's response
   * @throws Error if the process fails or returns invalid response
   */
  async dispatch(agentRequest: AgentRequest): Promise<AgentResponse> {
    console.log(
      `🚀 [BidirectionalStdioAgentTransport] Calling agent: ${this.config.command} ${(
        this.config.args || []
      ).join(' ')}`
    );

    return new Promise((resolve, reject) => {
      this.agentResponseResolver = resolve;
      this.agentResponseRejecter = reject;

      this.startProcess()
        .then(() => {
          // Send initial agent request
          this.sendMessage({ type: 'agent_request', data: agentRequest });

          // Set up overall timeout for the agent call
          const timeoutMs = getAgentCallTimeout();
          const timeoutId = setTimeout(() => {
            this.cleanup();
            reject(new Error(`Agent call timeout after ${timeoutMs}ms`));
          }, timeoutMs);

          // Clean up timeout when done
          const originalResolve = this.agentResponseResolver;
          const originalReject = this.agentResponseRejecter;

          this.agentResponseResolver = (response: AgentResponse) => {
            clearTimeout(timeoutId);
            originalResolve?.(response);
          };

          this.agentResponseRejecter = (error: Error) => {
            clearTimeout(timeoutId);
            originalReject?.(error);
          };
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  /**
   * Start the agent process with bidirectional communication
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

      // Handle stdout data (messages from agent)
      this.process.stdout.on('data', (data: Buffer) => {
        this.handleStdoutData(data.toString());
      });

      // Handle stderr for logging
      this.process.stderr.on('data', (data: Buffer) => {
        console.warn(
          `⚠️ [BidirectionalStdioAgentTransport] ${this.config.command} stderr:`,
          data.toString().trim()
        );
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        console.log(
          `🔄 [BidirectionalStdioAgentTransport] ${this.config.command} process exited with code ${code}, signal ${signal}`
        );
        this.cleanup();
        if (code !== 0 && this.agentResponseRejecter) {
          this.agentResponseRejecter(
            new Error(`Agent process exited with code ${code}, signal ${signal}`)
          );
        }
      });

      // Handle process errors
      this.process.on('error', (error) => {
        console.error(
          `❌ [BidirectionalStdioAgentTransport] ${this.config.command} process error:`,
          error
        );
        this.cleanup();
        reject(error);
      });

      // Process started successfully
      resolve();
    });
  }

  /**
   * Send a message to the agent process
   */
  private sendMessage(message: StdioMessage): void {
    if (!this.process?.stdin) {
      throw new Error('Process stdin not available');
    }

    const messageData = `${JSON.stringify(message)}\n`;
    this.process.stdin.write(messageData, (error) => {
      if (error && this.agentResponseRejecter) {
        this.agentResponseRejecter(new Error(`Failed to send message: ${error.message}`));
      }
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
          console.error(
            `❌ [BidirectionalStdioAgentTransport] Failed to parse JSON message:`,
            line,
            error
          );
          if (this.agentResponseRejecter) {
            this.agentResponseRejecter(
              new Error(`Invalid JSON message from agent: ${error}. Message: ${line}`)
            );
          }
        }
      }
    }
  }

  /**
   * Handle parsed message from agent
   */
  private async handleMessage(message: StdioMessage): Promise<void> {
    switch (message.type) {
      case 'agent_response':
        this.handleAgentResponse(message.data);
        break;

      case 'mcp_request':
        await this.handleMcpRequest(message.id, message.data);
        break;

      case 'error':
        this.handleErrorMessage(message);
        break;

      default:
        console.warn(`⚠️ [BidirectionalStdioAgentTransport] Unknown message type:`, message.type);
    }
  }

  /**
   * Handle agent response (final response)
   */
  private handleAgentResponse(agentResponse: AgentResponse): void {
    try {
      this.validateAgentResponse(agentResponse);
      console.log(`✅ [BidirectionalStdioAgentTransport] Agent responded successfully`);
      this.cleanup();
      this.agentResponseResolver?.(agentResponse);
    } catch (error) {
      this.cleanup();
      this.agentResponseRejecter?.(error as Error);
    }
  }

  /**
   * Handle MCP request from agent
   */
  private async handleMcpRequest(requestId: string, mcpRequest: MCPRequest): Promise<void> {
    try {
      console.log(
        `📡 [BidirectionalStdioAgentTransport] Handling MCP request ${requestId}: ${mcpRequest.method}`
      );

      // Call MCP service directly (no HTTP overhead)
      const mcpResponse = await this.mcpService.handleMCPRequest(mcpRequest);

      // Send response back to agent
      this.sendMessage({
        type: 'mcp_response',
        id: requestId,
        data: mcpResponse,
      });

      console.log(
        `✅ [BidirectionalStdioAgentTransport] MCP request ${requestId} completed successfully`
      );
    } catch (error) {
      console.error(
        `❌ [BidirectionalStdioAgentTransport] MCP request ${requestId} failed:`,
        error
      );

      // Send error response back to agent
      this.sendMessage({
        type: 'mcp_response',
        id: requestId,
        data: {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          error: {
            code: -32603, // Internal error
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      });
    }
  }

  /**
   * Handle error message from agent
   */
  private handleErrorMessage(message: { type: 'error'; id?: string; message: string }): void {
    console.error(
      `❌ [BidirectionalStdioAgentTransport] Agent error${message.id ? ` (${message.id})` : ''}:`,
      message.message
    );

    if (this.agentResponseRejecter) {
      this.cleanup();
      this.agentResponseRejecter(new Error(`Agent error: ${message.message}`));
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Reject all pending MCP requests
    for (const [, pending] of this.pendingMcpRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Agent connection was closed'));
    }
    this.pendingMcpRequests.clear();

    // Kill process if still running
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
    this.agentResponseResolver = null;
    this.agentResponseRejecter = null;
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
