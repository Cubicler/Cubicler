import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  handleDispatchError,
  handleMCPError,
  handleWebhookError,
  handleSSEError,
  handleServiceError,
} from '../../src/utils/error-handling-utils.js';

describe('Error Handling Utils', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockRequest = {
      params: {},
      path: '/test',
      method: 'POST',
    } as Request;

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();

    // Mock console.error to avoid noise in tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('handleDispatchError', () => {
    it('should handle Error instances with agentId', () => {
      const error = new Error('Dispatch failed');
      mockRequest.params = { agentId: 'test_agent' };

      handleDispatchError(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Dispatch failed' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [Server] POST /dispatch/test_agent - Error: Dispatch failed'
      );
    });

    it('should handle Error instances without agentId', () => {
      const error = new Error('General dispatch error');
      mockRequest.params = {};

      handleDispatchError(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'General dispatch error' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [Server] POST /dispatch - Error: General dispatch error'
      );
    });

    it('should handle non-Error values', () => {
      const error = 'String error';
      mockRequest.params = {};

      handleDispatchError(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unknown error' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [Server] POST /dispatch - Error: Unknown error'
      );
    });
  });

  describe('handleMCPError', () => {
    it('should handle MCP error with request ID', () => {
      const error = new Error('MCP protocol error');
      const mcpRequestId = 'req-123';

      handleMCPError(
        error,
        mcpRequestId,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 'req-123',
        error: { code: -32603, message: 'Internal error: MCP protocol error' },
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [Server] POST /mcp - Error: MCP protocol error'
      );
    });

    it('should handle MCP error without request ID', () => {
      const error = new Error('MCP error');
      const mcpRequestId = null;

      handleMCPError(
        error,
        mcpRequestId,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'Internal error: MCP error' },
      });
    });

    it('should handle non-Error values in MCP', () => {
      const error = { message: 'Object error' };
      const mcpRequestId = 42;

      handleMCPError(
        error,
        mcpRequestId,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 42,
        error: { code: -32603, message: 'Internal error: Unknown error' },
      });
    });
  });

  describe('handleWebhookError', () => {
    beforeEach(() => {
      mockRequest.params = { identifier: 'github', agentId: 'agent_1' };
    });

    it('should handle "not found" errors with 404 status', () => {
      const error = new Error('Webhook not found');

      handleWebhookError(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Webhook not found' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [Server] POST /webhook/github/agent_1 - Error: Webhook not found'
      );
    });

    it('should handle "not authorized" errors with 403 status', () => {
      const error = new Error('User not authorized');

      handleWebhookError(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User not authorized' });
    });

    it('should handle signature errors with 401 status', () => {
      const error = new Error('Invalid signature provided');

      handleWebhookError(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication failed' });
    });

    it('should handle token errors with 401 status', () => {
      const error = new Error('Invalid token format');

      handleWebhookError(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication failed' });
    });

    it('should handle general errors with 500 status', () => {
      const error = new Error('Database connection failed');

      handleWebhookError(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Database connection failed' });
    });

    it('should handle non-Error values', () => {
      const error = 'String webhook error';

      handleWebhookError(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unknown error' });
    });
  });

  describe('handleSSEError', () => {
    beforeEach(() => {
      mockRequest.params = { agentId: 'sse_agent' };
      (mockRequest as any).path = '/sse/sse_agent';
    });

    it('should handle SSE errors with agent information', () => {
      const error = new Error('SSE connection failed');

      handleSSEError(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'SSE connection failed' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [Server] /sse/sse_agent error for agent sse_agent: SSE connection failed'
      );
    });

    it('should handle non-Error values in SSE', () => {
      const error = null;

      handleSSEError(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unknown error' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [Server] /sse/sse_agent error for agent sse_agent: Unknown error'
      );
    });
  });

  describe('handleServiceError', () => {
    beforeEach(() => {
      (mockRequest as any).method = 'GET';
      (mockRequest as any).path = '/health';
    });

    it('should handle service errors with request method and path', () => {
      const error = new Error('Service unavailable');

      handleServiceError(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Service unavailable' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [Server] GET /health - Error: Service unavailable'
      );
    });

    it('should handle non-Error values in service errors', () => {
      const error = { code: 'SERVICE_DOWN' };

      handleServiceError(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unknown error' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ [Server] GET /health - Error: Unknown error'
      );
    });

    it('should handle different HTTP methods', () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'] as const;

      methods.forEach((method) => {
        const error = new Error(`${method} error`);
        (mockRequest as any).method = method;
        (mockRequest as any).path = `/test/${method.toLowerCase()}`;

        handleServiceError(error, mockRequest as Request, mockResponse as Response, mockNext);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          `❌ [Server] ${method} /test/${method.toLowerCase()} - Error: ${method} error`
        );
      });
    });
  });
});
