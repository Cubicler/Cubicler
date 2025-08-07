import type { NextFunction, Request, Response } from 'express';
import type { DispatchRequest } from '../model/dispatch.js';
import type { MCPRequest } from '../model/types.js';

export function validateDispatchRequest(req: Request, res: Response, next: NextFunction): void {
  const request: DispatchRequest = req.body;

  // Handle case where body is undefined (JSON parsing failed)
  if (!request) {
    console.log(`⚠️ [ValidationMiddleware] Invalid JSON in request body`);
    res.status(400).json({ error: 'Invalid JSON in request body' });
    return;
  }

  // Validate messages array exists
  if (!request.messages) {
    console.log(`⚠️ [ValidationMiddleware] Missing messages array`);
    res.status(400).json({ error: 'Messages array is required' });
    return;
  }

  // Validate messages array is not empty
  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    console.log(`⚠️ [ValidationMiddleware] Empty messages array`);
    res.status(400).json({ error: 'Messages array must not be empty' });
    return;
  }

  // Validate message format
  for (let i = 0; i < request.messages.length; i++) {
    const message = request.messages[i];
    if (!message || !message.sender || !message.type || !message.content) {
      console.log(`⚠️ [ValidationMiddleware] Invalid message format at index ${i}`);
      res.status(400).json({
        error: `Invalid message format: missing required fields (sender, type, content) at index ${i}`,
      });
      return;
    }
  }

  next();
}

export function validateMCPRequest(req: Request, res: Response, next: NextFunction): void {
  const mcpRequest: MCPRequest = req.body;

  if (!mcpRequest.jsonrpc || mcpRequest.jsonrpc !== '2.0') {
    res.status(400).json({
      jsonrpc: '2.0',
      id: mcpRequest.id || null,
      error: { code: -32600, message: 'Invalid Request: Missing or invalid jsonrpc version' },
    });
    return;
  }

  next();
}

export function validateWebhookRequest(req: Request, res: Response, next: NextFunction): void {
  const payload = req.body;

  if (!payload || typeof payload !== 'object') {
    console.log(`⚠️ [ValidationMiddleware] Webhook request missing or invalid payload`);
    res.status(400).json({ error: 'Valid JSON payload is required' });
    return;
  }

  next();
}

export function validateAgentId(req: Request, res: Response, next: NextFunction): void {
  const { agentId } = req.params;

  if (!agentId) {
    console.log(`⚠️ [ValidationMiddleware] Missing agent ID`);
    res.status(400).json({ error: 'Agent ID is required' });
    return;
  }

  next();
}

export function validateWebhookParams(req: Request, res: Response, next: NextFunction): void {
  const { identifier, agentId } = req.params;

  if (!identifier || !agentId) {
    console.log(`⚠️ [ValidationMiddleware] Webhook request missing identifier or agent ID`);
    res.status(400).json({ error: 'Webhook identifier and agent ID are required' });
    return;
  }

  next();
}
