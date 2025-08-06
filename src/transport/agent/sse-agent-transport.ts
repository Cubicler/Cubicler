import type { AgentTransport } from '../../interface/agent-transport.js';
import type { AgentRequest, AgentResponse } from '../../model/dispatch.js';
import type { SseTransportConfig } from '../../model/agents.js';
import { fetchWithAgentTimeout } from '../../utils/fetch-helper.js';
import jwtHelper from '../../utils/jwt-helper.js';

/**
 * SSE transport implementation for agent communication
 * Handles Server-Sent Events streaming communication with agents
 */
export class SseAgentTransport implements AgentTransport {
  /**
   * Creates a new SseAgentTransport instance
   * @param config - SSE transport configuration
   */
  constructor(private readonly config: SseTransportConfig) {
    if (!config?.url || typeof config.url !== 'string') {
      throw new Error('Agent URL must be a non-empty string');
    }
  }

  /**
   * Call the agent via SSE streaming request
   * @param agentRequest - The request to send to the agent
   * @returns Promise that resolves to the agent's response
   * @throws Error if the SSE request fails or returns invalid response
   */
  async dispatch(agentRequest: AgentRequest): Promise<AgentResponse> {
    console.log(`🚀 [SseAgentTransport] Starting SSE connection to ${this.config.url}`);

    try {
      const headers = await this.buildHeaders();

      // Add SSE-specific headers
      headers.Accept = 'text/event-stream';
      headers['Cache-Control'] = 'no-cache';

      const response = await this.streamFromAgent(agentRequest, headers);

      console.log(`✅ [SseAgentTransport] Agent responded successfully via SSE`);
      return response;
    } catch (error) {
      console.error(`❌ [SseAgentTransport] Agent call failed:`, error);
      throw error;
    }
  }

  /**
   * Stream data from agent using SSE
   * @param agentRequest - The request to send to the agent
   * @param headers - HTTP headers for the request
   * @returns Promise that resolves to the complete agent response
   */
  private async streamFromAgent(
    agentRequest: AgentRequest,
    headers: Record<string, string>
  ): Promise<AgentResponse> {
    return new Promise((resolve, reject) => {
      let responseBuffer = '';
      let hasReceivedData = false;
      let finalResponse: AgentResponse | null = null;
      let isResolved = false;

      // Set timeout for the entire SSE session
      const timeoutId = globalThis.setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error('SSE request timed out'));
        }
      }, 300000); // 5 minutes timeout

      const safeResolve = (value: AgentResponse) => {
        if (!isResolved) {
          isResolved = true;
          globalThis.clearTimeout(timeoutId);
          resolve(value);
        }
      };

      const safeReject = (reason: Error | string | unknown) => {
        if (!isResolved) {
          isResolved = true;
          globalThis.clearTimeout(timeoutId);
          reject(reason);
        }
      };

      const processSSEData = (data: string) => {
        const lines = data.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const eventData = line.slice(6); // Remove 'data: ' prefix

            if (eventData === '[DONE]') {
              // SSE stream completed
              if (finalResponse) {
                safeResolve(finalResponse);
              } else {
                safeReject(new Error('SSE stream completed but no final response received'));
              }
              return;
            }

            try {
              const parsedData = JSON.parse(eventData);

              // Handle different SSE event types
              if (parsedData.type === 'content_delta') {
                responseBuffer += parsedData.content || '';
                hasReceivedData = true;
              } else if (parsedData.type === 'response_complete') {
                // Final response with metadata
                finalResponse = {
                  timestamp: parsedData.timestamp || new Date().toISOString(),
                  type: 'text',
                  content: responseBuffer,
                  metadata: parsedData.metadata || { usedToken: 0, usedTools: 0 },
                };
              }
            } catch (parseError) {
              console.warn(`⚠️ [SseAgentTransport] Failed to parse SSE data:`, parseError);
            }
          }
        }
      };

      // Use fetch with timeout for the SSE connection
      fetchWithAgentTimeout(this.config.url, {
        method: 'POST',
        headers,
        data: agentRequest,
        responseType: 'stream',
      })
        .then((response) => {
          this.validateHttpResponse(response);

          // Handle the response as a stream
          if (response.data && typeof response.data.on === 'function') {
            response.data.on('data', (chunk: Buffer) => {
              const chunkStr = chunk.toString();
              processSSEData(chunkStr);
            });

            response.data.on('end', () => {
              if (!hasReceivedData) {
                safeReject(new Error('SSE stream ended without receiving any data'));
              } else if (finalResponse) {
                safeResolve(finalResponse);
              } else {
                // Create fallback response if no final response was received
                safeResolve({
                  timestamp: new Date().toISOString(),
                  type: 'text',
                  content: responseBuffer,
                  metadata: { usedToken: 0, usedTools: 0 },
                });
              }
            });

            response.data.on('error', (error: Error) => {
              safeReject(new Error(`SSE stream error: ${error.message}`));
            });
          } else {
            safeReject(new Error('Invalid SSE response format'));
          }
        })
        .catch((error) => {
          safeReject(error);
        });
    });
  }

  /**
   * Build HTTP headers including JWT authentication if configured
   * @returns Promise that resolves to headers object
   * @throws Error if JWT token cannot be obtained
   */
  private async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.auth?.type === 'jwt') {
      const token = await jwtHelper.getToken(this.config.auth.config);
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Validate HTTP response status
   * @param response - HTTP response from agent
   * @throws Error if status indicates failure
   */
  private validateHttpResponse(response: { status: number; statusText?: string }): void {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Agent responded with status ${response.status}: ${response.statusText || 'Unknown error'}`
      );
    }
  }
}
