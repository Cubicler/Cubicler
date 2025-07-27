import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { app } from '../src/index.js';
import type { Server } from 'http';

describe('Integration Test - Full Cubicler Flow', () => {
  let mockApiServer: Server;
  const mockApiPort = 3002;

  beforeAll(async () => {
    // Set up environment variables for testing
    process.env.CUBICLER_SPEC_SOURCE = './tests/mocks/integration-spec.yaml';
    process.env.CUBICLER_PROMPTS_SOURCE = './tests/mocks/integration-prompt.md';
    process.env.CUBICLER_AGENTS_LIST = './tests/mocks/test-agents.yaml';
    process.env.CUBICLER_PROVIDERS_LIST = './tests/mocks/test-providers.yaml';

    // Create mock API server
    const mockApp = express();
    mockApp.use(express.json());

    // Mock endpoint that our function will call
    mockApp.get('/data/:id', (req: Request, res: Response) => {
      const { id } = req.params;

      // Verify headers
      expect(req.headers['x-api-key']).toBe('test-key');

      res.json({
        id: id,
        data: `Test data for ID: ${id}`,
        timestamp: new Date().toISOString(),
      });
    });

    mockApiServer = mockApp.listen(mockApiPort);
  });

  afterAll(async () => {
    // Close mock API server
    if (mockApiServer) {
      mockApiServer.close();
    }
  });

  it('should serve the system prompt via GET /prompt/:agentName', async () => {
    const response = await request(app).get('/prompt/default').expect(200);

    expect(response.body.prompt).toContain(
      'You are a helpful assistant for testing Cubicler integration'
    );
  });

  it('should execute function calls via POST /execute/:function_name', async () => {
    const response = await request(app)
      .post('/execute/mock_service.getData')
      .send({ id: '123' })
      .expect(200);

    expect(response.body).toEqual({
      id: '123',
      data: 'Test data for ID: 123',
      timestamp: expect.any(String),
    });
  });

  it('should handle function execution errors properly', async () => {
    const response = await request(app)
      .post('/execute/mock_service.nonExistentFunction')
      .send({ id: '123' })
      .expect(500);

    expect(response.body.error).toContain(
      "Function 'nonExistentFunction' not found in provider 'mock_service'"
    );
  });

  it('should return health status via GET /health', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('healthy');
    expect(response.body.services.prompt.status).toBe('healthy');
    expect(response.body.services.agents.status).toBe('healthy');
    expect(response.body.services.providers.status).toBe('healthy');
    expect(response.body.timestamp).toBeDefined();
  });
});
