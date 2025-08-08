import type { NextFunction, Request, Response } from 'express';

export function handleDispatchError(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const endpoint = req.params.agentId ? `/dispatch/${req.params.agentId}` : '/dispatch';

  console.error(`❌ [Server] POST ${endpoint} - Error: ${errorMessage}`);

  // Return appropriate error status codes based on error message
  if (errorMessage.toLowerCase().includes('not found')) {
    res.status(404).json({ error: errorMessage });
  } else if (errorMessage.toLowerCase().includes('not authorized')) {
    res.status(403).json({ error: errorMessage });
  } else if (
    errorMessage.toLowerCase().includes('validation') ||
    errorMessage.toLowerCase().includes('invalid')
  ) {
    res.status(400).json({ error: errorMessage });
  } else {
    res.status(500).json({ error: errorMessage });
  }
}

export function handleMCPError(
  error: unknown,
  mcpRequestId: string | number | null,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  console.error(`❌ [Server] POST /mcp - Error: ${errorMessage}`);
  res.status(500).json({
    jsonrpc: '2.0',
    id: mcpRequestId,
    error: { code: -32603, message: `Internal error: ${errorMessage}` },
  });
}

export function handleWebhookError(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const { identifier, agentId } = req.params;

  console.error(`❌ [Server] POST /webhook/${identifier}/${agentId} - Error: ${errorMessage}`);

  // Return appropriate error status codes based on error message
  if (errorMessage.includes('not found') || errorMessage.includes('not authorized')) {
    res.status(errorMessage.includes('not authorized') ? 403 : 404).json({ error: errorMessage });
  } else if (errorMessage.includes('signature') || errorMessage.includes('token')) {
    res.status(401).json({ error: 'Authentication failed' });
  } else {
    res.status(500).json({ error: errorMessage });
  }
}

export function handleSSEError(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const { agentId } = req.params;
  const endpoint = req.path;

  console.error(`❌ [Server] ${endpoint} error for agent ${agentId}: ${errorMessage}`);
  res.status(500).json({ error: errorMessage });
}

export function handleServiceError(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  console.error(`❌ [Server] ${req.method} ${req.path} - Error: ${errorMessage}`);
  res.status(500).json({ error: errorMessage });
}
