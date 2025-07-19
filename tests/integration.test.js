import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Integration Test - Full Cubicle Flow', () => {
  let mockApiServer;
  let mockApiPort = 3002;

  beforeAll(async () => {
    // Set up environment variables for testing
    process.env.CUBICLE_SPEC_SOURCE = './tests/integrationSpec.yaml';
    process.env.CUBICLE_PROMPT_SOURCE = './tests/integrationPrompt.md';

    // Create mock API server
    const mockApp = express();
    mockApp.use(express.json());

    // Mock endpoint that our function will call
    mockApp.get('/users/:id', (req, res) => {
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

  it('should serve the system prompt via GET /prompt', async () => {
    const response = await request(app)
      .get('/prompt')
      .expect(200);

    expect(response.body.prompt).toContain('You are a helpful assistant for testing Cubicle integration');
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
});
