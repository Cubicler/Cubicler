import type { Response } from 'express';
import type { DispatchResponse } from '../model/dispatch.js';
import type { AgentInfo } from '../model/agents.js';
import type { HealthStatus, JSONValue, MCPResponse } from '../model/types.js';

/**
 * Endpoint information for API discovery
 */
interface EndpointInfo {
  method: string;
  path: string;
  service: string;
}

export function formatDispatchSuccess(result: DispatchResponse, res: Response): void {
  console.log(`✅ [Server] Dispatch - Success`);
  res.json(result);
}

export function formatMCPSuccess(result: MCPResponse, res: Response): void {
  console.log(`✅ [Server] POST /mcp - Success`);
  res.json(result);
}

export function formatWebhookSuccess(result: DispatchResponse, res: Response): void {
  console.log(`✅ [Server] Webhook - Success`);
  res.json(result);
}

export function formatSSESuccess(result: JSONValue | null, res: Response): void {
  console.log(`✅ [Server] SSE - Success`);
  if (result === null || result === undefined) {
    res.json({ success: true });
  } else {
    res.json(result);
  }
}

export function formatAgentsListSuccess(agents: AgentInfo[], res: Response): void {
  console.log(`✅ [Server] GET /agents - Success (${agents.length} agents)`);
  res.json({
    total: agents.length,
    agents,
  });
}

export function formatHealthSuccess(health: HealthStatus, res: Response): void {
  const statusCode = health.status === 'healthy' ? 200 : 503;
  console.log(
    `${health.status === 'healthy' ? '✅' : '❌'} [Server] Health check: ${health.status}`
  );
  res.status(statusCode).json(health);
}

export function formatEndpointsSuccess(endpoints: EndpointInfo[], res: Response): void {
  console.log(`✅ [Server] GET /endpoints - Success (${endpoints.length} endpoints)`);
  res.json({
    total: endpoints.length,
    endpoints,
  });
}
