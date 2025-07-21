import { jest } from '@jest/globals';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { app } from '../src/index.js';
import type { Server } from 'http';

describe('Integration Test - Full Cubicler Flow', () => {
  let mockApiServer: Server;
  let mockApiPort = 3002;

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
    mockApp.get('/users/:id', (req: Request, res: Response) => {
      const { id } = req.params;
      const { include_details } = req.query;
      
      // Verify the override parameter was applied
      expect(include_details).toBe('true');
      
      // Verify headers
      expect(req.headers.authorization).toBe('Bearer test-token');
      
      res.json({
        id: id,
        name: `User ${id}`,
        email: `user${id}@example.com`,
        details: include_details === 'true' ? { role: 'admin' } : null
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
    const response = await request(app)
      .get('/prompt/default')
      .expect(200);

    expect(response.body.prompt).toContain('You are a helpful assistant for testing Cubicler integration');
  });

  it('should serve the function spec via GET /spec', async () => {
    const response = await request(app)
      .get('/spec')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('getUserById');
    expect(response.body[0].description).toBe('Get user information by ID');
    
    // Should not include override parameters in the AI spec
    expect(response.body[0].parameters.properties).not.toHaveProperty('include_details');
    expect(response.body[0].parameters.properties).toHaveProperty('id');
  });

  it('should execute function calls via POST /call/:function_name', async () => {
    const response = await request(app)
      .post('/call/getUserById')
      .send({ id: '123' })
      .expect(200);

    expect(response.body).toEqual({
      id: '123',
      name: 'User 123',
      email: 'user123@example.com',
      details: { role: 'admin' } // This proves override parameter worked
    });
  });

  it('should handle function call errors properly', async () => {
    const response = await request(app)
      .post('/call/nonExistentFunction')
      .send({ id: '123' })
      .expect(500);

    expect(response.body.error).toContain('Function nonExistentFunction not found');
  });

  it('should return health status via GET /health', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('healthy');
    expect(response.body.services.prompt.status).toBe('healthy');
    expect(response.body.services.agents.status).toBe('healthy');
    expect(response.body.services.providers.status).toBe('healthy');
    expect(response.body.services.spec.status).toBe('healthy');
    expect(response.body.timestamp).toBeDefined();
  });
});
