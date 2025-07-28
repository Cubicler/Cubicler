import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Integration Tests', () => {
  let app: express.Application;
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    
    // Set up test environment
    process.env.CUBICLER_AGENTS_LIST = './tests/mocks/test-agents.json';
    process.env.CUBICLER_PROVIDERS_LIST = './tests/mocks/test-providers.json';
    process.env.CUBICLER_PORT = '0'; // Use random port for testing
    process.env.AGENTS_LIST_CACHE_ENABLED = 'false';
    process.env.PROVIDERS_LIST_CACHE_ENABLED = 'false';

    // Import the app
    const { app: cubiclerApp } = await import('../../src/cubicler.js');
    app = cubiclerApp;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET /health', () => {
    it('should return health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.services).toBeDefined();
    });
  });

  describe('GET /agents', () => {
    it('should return list of available agents', async () => {
      const response = await request(app)
        .get('/agents')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('agents');
      expect(Array.isArray(response.body.agents)).toBe(true);
      
      if (response.body.agents.length > 0) {
        const agent = response.body.agents[0];
        expect(agent).toHaveProperty('identifier');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('description');
      }
    });
  });

  describe('POST /dispatch', () => {
    it('should validate request body', async () => {
      const response = await request(app)
        .post('/dispatch')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('Messages array is required');
    });

    it('should validate messages array', async () => {
      const response = await request(app)
        .post('/dispatch')
        .send({ messages: [] })
        .expect(400);

      expect(response.body.error).toContain('must not be empty');
    });

    it('should handle malformed message format', async () => {
      const response = await request(app)
        .post('/dispatch')
        .send({
          messages: [
            { content: 'Missing sender' } // Invalid message format
          ]
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    // Note: Testing successful dispatch would require a running agent server
    // This is better suited for full end-to-end tests
  });

  describe('POST /dispatch/:agentId', () => {
    it('should accept agent ID parameter', async () => {
      const response = await request(app)
        .post('/dispatch/gpt_4o')
        .send({
          messages: [
            {
              sender: { id: 'test_user' },
              type: 'text',
              content: 'Hello'
            }
          ]
        });

      // May fail with agent connection error, but should not be a routing error
      expect(response.status).not.toBe(404);
    });
  });

  describe('POST /mcp', () => {
    it('should handle MCP protocol requests', async () => {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };

      const response = await request(app)
        .post('/mcp')
        .send(mcpRequest);

      // Should handle MCP request (may return error due to missing real MCP servers)
      expect(response.status).not.toBe(404);
      expect(response.body).toHaveProperty('jsonrpc');
    });

    it('should validate MCP request format', async () => {
      const invalidMcpRequest = {
        // Missing required jsonrpc field
        id: 1,
        method: 'tools/list'
      };

      const response = await request(app)
        .post('/mcp')
        .send(invalidMcpRequest)
        .expect(400);

      expect(response.body.error).toHaveProperty('message');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/unknown-endpoint')
        .expect(404);

      expect(response.body.error).toBe('Endpoint not found');
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/dispatch')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('CORS Headers', () => {
    it('should not include CORS headers when CORS is disabled (default)', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.headers['access-control-allow-methods']).toBeUndefined();
    });

    it('should include CORS headers when CORS is enabled', async () => {
      // Set CORS enabled for this test
      process.env.ENABLE_CORS = 'true';
      
      // Re-import the app to apply the new environment variable
      vi.resetModules();
      const { app: corsEnabledApp } = await import('../../src/cubicler.js');
      
      const response = await request(corsEnabledApp)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    it('should handle preflight OPTIONS requests when CORS is enabled', async () => {
      // Set CORS enabled for this test
      process.env.ENABLE_CORS = 'true';
      
      // Re-import the app to apply the new environment variable
      vi.resetModules();
      const { app: corsEnabledApp } = await import('../../src/cubicler.js');
      
      const response = await request(corsEnabledApp)
        .options('/dispatch')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    it('should not handle preflight OPTIONS requests when CORS is disabled', async () => {
      // CORS is disabled by default in our beforeEach setup
      const response = await request(app)
        .options('/dispatch')
        .expect(404); // Should return 404 since OPTIONS handler is not registered

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
