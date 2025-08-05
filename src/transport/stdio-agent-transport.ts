import { spawn } from 'child_process';
import type { AgentTransport } from '../interface/agent-transport.js';
import type { AgentRequest, AgentResponse } from '../model/dispatch.js';
import { getAgentCallTimeout } from '../utils/env-helper.js';

// Node.js globals for timeout handling
/* eslint-disable no-undef */
declare const setTimeout: (_callback: () => void, _ms: number) => NodeJS.Timeout;
declare const clearTimeout: (_id: NodeJS.Timeout) => void;
/* eslint-enable no-undef */

/**
 * Stdio transport implementation for agent communication
 * Handles stdio-based communication with local agents via process spawning
 */
export class StdioAgentTransport implements AgentTransport {
  private readonly command: string;
  private readonly args: string[];

  /**
   * Creates a new StdioAgentTransport instance
   * @param commandString - The command string (command + args) to execute the agent
   */
  constructor(commandString: string) {
    if (!commandString || typeof commandString !== 'string') {
      throw new Error('Agent command must be a non-empty string');
    }

    const parts = commandString.trim().split(/\s+/);
    if (parts.length === 0 || parts[0] === '') {
      throw new Error('Agent command cannot be empty');
    }

    this.command = parts[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- Safe: we just checked length > 0
    this.args = parts.slice(1);
  }

  /**
   * Call the agent via stdio communication
   * @param agentRequest - The request to send to the agent
   * @returns Promise that resolves to the agent's response
   * @throws Error if the process fails or returns invalid response
   */
  async dispatch(agentRequest: AgentRequest): Promise<AgentResponse> {
    console.log(`🚀 [StdioAgentTransport] Calling agent: ${this.command} ${this.args.join(' ')}`);

    return new Promise((resolve, reject) => {
      const child = spawn(this.command, this.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let responseData = '';
      let errorData = '';

      // Set up timeout
      const timeoutMs = getAgentCallTimeout();
      // eslint-disable-next-line no-undef
      const timeoutId: NodeJS.Timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Agent call timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Send request as JSON to stdin
      try {
        child.stdin.write(JSON.stringify(agentRequest));
        child.stdin.end();
      } catch (error) {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to write to agent process: ${error}`));
        return;
      }

      // Collect response from stdout
      child.stdout.on('data', (data) => {
        responseData += data.toString();
      });

      // Collect errors from stderr
      child.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      // Handle process completion
      child.on('close', (code, signal) => {
        clearTimeout(timeoutId);

        if (signal) {
          reject(new Error(`Agent process killed with signal ${signal}`));
          return;
        }

        if (code === 0) {
          try {
            const agentResponse = JSON.parse(responseData.trim());
            this.validateAgentResponse(agentResponse);
            console.log(`✅ [StdioAgentTransport] Agent responded successfully`);
            resolve(agentResponse);
          } catch (parseError) {
            reject(
              new Error(
                `Invalid JSON response from agent: ${parseError}. Response: ${responseData}`
              )
            );
          }
        } else {
          const errorMessage = errorData.trim() || `Process exited with code ${code}`;
          reject(new Error(`Agent process failed: ${errorMessage}`));
        }
      });

      // Handle process spawn errors
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to spawn agent process: ${error.message}`));
      });
    });
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
