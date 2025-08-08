import type { Response } from 'express';
import type { MCPResponse } from '../model/types.js';
import jwtHelper from '../utils/jwt-helper.js';
import serverConfigService from './server-config-service.js';

type Client = {
  id: string;
  res: Response;
  heartbeat: ReturnType<typeof globalThis.setInterval>;
  user?: unknown;
};

/**
 * In-memory coordinator for MCP over SSE connections.
 *
 * Flow:
 * - Client connects via GET /mcp/sse?clientId=...&token=...
 * - POST /mcp receives requests; if a matching client is connected, responses are emitted via SSE.
 */
export class McpSseService {
  private readonly clients = new Map<string, Client>();

  register(clientId: string, res: Response, user?: unknown): void {
    this.cleanup(clientId); // Ensure no stale entry

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Initial comment to open stream
    res.write(`: connected ${clientId}\n\n`);

    // Heartbeat every 15s
    const heartbeat = globalThis.setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        // If write fails, drop the client on next cleanup
        this.cleanup(clientId);
      }
    }, 15000);

    // On client disconnect
    res.on('close', () => {
      this.cleanup(clientId);
    });

    this.clients.set(clientId, { id: clientId, res, heartbeat, user });
    console.log(`✅ [McpSse] Client connected: ${clientId}`);
  }

  /** Send response to a specific SSE client. Returns false if no client is connected. */
  send(clientId: string, response: MCPResponse): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      client.res.write(`event: mcp-response\n`);
      client.res.write(`data: ${JSON.stringify(response)}\n\n`);
      return true;
    } catch (error) {
      console.warn(`⚠️ [McpSse] Failed to write to client ${clientId}:`, error);
      this.cleanup(clientId);
      return false;
    }
  }

  /** Remove client and clear heartbeat. */
  cleanup(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    globalThis.clearInterval(client.heartbeat);
    this.clients.delete(clientId);
    try {
      // Attempt to end the response cleanly
      client.res.end();
    } catch {
      // ignore
    }
    console.log(`🔌 [McpSse] Client disconnected: ${clientId}`);
  }

  getConnectedIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Verify optional JWT passed via query token for the 'mcp' endpoint.
   * Returns user info or undefined if no token and JWT not required.
   */
  async verifyQueryToken(token?: string): Promise<unknown | undefined> {
    const jwtCfg = serverConfigService.getEndpointJwtConfig('mcp');
    if (!jwtCfg) {
      // No JWT configured; allow anonymous
      return undefined;
    }

    // If configured, token is required for SSE channel
    const secret = (jwtCfg as { secret?: string }).secret;
    if (!secret) {
      throw new Error('JWT secret missing in server config for MCP endpoint');
    }

    if (!token) {
      throw new Error('Missing JWT token in query for MCP SSE');
    }

    const payload = await jwtHelper.verifyToken(token, secret, {
      issuer: (jwtCfg as { issuer?: string }).issuer,
      audience: (jwtCfg as { audience?: string }).audience,
      algorithms: (jwtCfg as { algorithms?: string[] }).algorithms as never,
    });
    return payload;
  }
}

export default new McpSseService();
