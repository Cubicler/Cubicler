import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  validateDispatchRequest,
  validateMCPRequest,
  validateWebhookRequest,
  validateAgentId,
  validateWebhookParams,
} from '../../src/utils/validation-utils.js';

describe('Validation Utils', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('validateDispatchRequest', () => {
    it('should call next() when valid dispatch request is provided', () => {
      mockRequest.body = {
        messages: [
          {
            sender: { id: 'user_1' },
            type: 'text',
            content: 'Hello, world!',
          },
        ],
      };

      validateDispatchRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should return 400 when body is undefined', () => {
      mockRequest.body = undefined;

      validateDispatchRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid JSON in request body' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '⚠️ [ValidationMiddleware] Invalid JSON in request body'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when messages array is missing', () => {
      mockRequest.body = {};

      validateDispatchRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Messages array is required' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '⚠️ [ValidationMiddleware] Missing messages array'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when messages is not an array', () => {
      mockRequest.body = {
        messages: 'not an array',
      };

      validateDispatchRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Messages array must not be empty' });
      expect(consoleLogSpy).toHaveBeenCalledWith('⚠️ [ValidationMiddleware] Empty messages array');
    });

    it('should return 400 when messages array is empty', () => {
      mockRequest.body = {
        messages: [],
      };

      validateDispatchRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Messages array must not be empty' });
      expect(consoleLogSpy).toHaveBeenCalledWith('⚠️ [ValidationMiddleware] Empty messages array');
    });

    it('should return 400 when message is missing required fields', () => {
      mockRequest.body = {
        messages: [
          {
            sender: { id: 'user_1' },
            type: 'text',
            // missing content
          },
        ],
      };

      validateDispatchRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid message format: missing required fields (sender, type, content) at index 0',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '⚠️ [ValidationMiddleware] Invalid message format at index 0'
      );
    });

    it('should return 400 when multiple messages and one is invalid', () => {
      mockRequest.body = {
        messages: [
          {
            sender: { id: 'user_1' },
            type: 'text',
            content: 'Valid message',
          },
          {
            sender: { id: 'user_2' },
            // missing type and content
          },
        ],
      };

      validateDispatchRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid message format: missing required fields (sender, type, content) at index 1',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '⚠️ [ValidationMiddleware] Invalid message format at index 1'
      );
    });
  });

  describe('validateMCPRequest', () => {
    it('should call next() when valid MCP request is provided', () => {
      mockRequest.body = {
        jsonrpc: '2.0',
        id: 'req-123',
        method: 'tools/list',
      };

      validateMCPRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should return 400 when jsonrpc is missing', () => {
      mockRequest.body = {
        id: 'req-123',
        method: 'tools/list',
      };

      validateMCPRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 'req-123',
        error: { code: -32600, message: 'Invalid Request: Missing or invalid jsonrpc version' },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when jsonrpc version is incorrect', () => {
      mockRequest.body = {
        jsonrpc: '1.0',
        id: 'req-123',
        method: 'tools/list',
      };

      validateMCPRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 'req-123',
        error: { code: -32600, message: 'Invalid Request: Missing or invalid jsonrpc version' },
      });
    });

    it('should handle missing id in error response', () => {
      mockRequest.body = {
        jsonrpc: '1.0',
        method: 'tools/list',
      };

      validateMCPRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid Request: Missing or invalid jsonrpc version' },
      });
    });
  });

  describe('validateWebhookRequest', () => {
    it('should call next() when valid webhook payload is provided', () => {
      mockRequest.body = {
        action: 'push',
        repository: {
          name: 'test-repo',
        },
      };

      validateWebhookRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should return 400 when payload is missing', () => {
      mockRequest.body = undefined;

      validateWebhookRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Valid JSON payload is required' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '⚠️ [ValidationMiddleware] Webhook request missing or invalid payload'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when payload is not an object', () => {
      mockRequest.body = 'string payload';

      validateWebhookRequest(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Valid JSON payload is required' });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '⚠️ [ValidationMiddleware] Webhook request missing or invalid payload'
      );
    });
  });

  describe('validateAgentId', () => {
    it('should call next() when agentId is provided', () => {
      mockRequest.params = { agentId: 'test_agent' };

      validateAgentId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should return 400 when agentId is missing', () => {
      mockRequest.params = {};

      validateAgentId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Agent ID is required' });
      expect(consoleLogSpy).toHaveBeenCalledWith('⚠️ [ValidationMiddleware] Missing agent ID');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when agentId is empty string', () => {
      mockRequest.params = { agentId: '' };

      validateAgentId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Agent ID is required' });
    });
  });

  describe('validateWebhookParams', () => {
    it('should call next() when both identifier and agentId are provided', () => {
      mockRequest.params = { identifier: 'github', agentId: 'test_agent' };

      validateWebhookParams(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should return 400 when identifier is missing', () => {
      mockRequest.params = { agentId: 'test_agent' };

      validateWebhookParams(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Webhook identifier and agent ID are required',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '⚠️ [ValidationMiddleware] Webhook request missing identifier or agent ID'
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when agentId is missing', () => {
      mockRequest.params = { identifier: 'github' };

      validateWebhookParams(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Webhook identifier and agent ID are required',
      });
    });

    it('should return 400 when both are missing', () => {
      mockRequest.params = {};

      validateWebhookParams(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Webhook identifier and agent ID are required',
      });
    });

    it('should return 400 when identifier is empty string', () => {
      mockRequest.params = { identifier: '', agentId: 'test_agent' };

      validateWebhookParams(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Webhook identifier and agent ID are required',
      });
    });
  });
});
