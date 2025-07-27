import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index.js';
import agentService from '../../src/core/agent-service.js';

describe('GET /agents endpoint', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.CUBICLER_AGENTS_LIST = './tests/mocks/test-agents.yaml';
    process.env.AGENTS_LIST_CACHE_ENABLED = 'false'; // Disable cache for tests

    // Clear caches to ensure clean state between tests
    agentService.clearCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    agentService.clearCache();
  });

  it('should return available agents', async () => {
    const response = await request(app).get('/agents').expect(200);

    expect(response.body).toHaveProperty('availableAgents');
    expect(Array.isArray(response.body.availableAgents)).toBe(true);
    expect(response.body.availableAgents.length).toBeGreaterThan(0);
  });

  it('should return 500 when agents list is not found', async () => {
    process.env.CUBICLER_AGENTS_LIST = './nonexistent.yaml';

    const response = await request(app).get('/agents').expect(500);

    expect(response.body).toHaveProperty('error');
  });

  it('should return 500 when CUBICLER_AGENTS_LIST is not defined', async () => {
    delete process.env.CUBICLER_AGENTS_LIST;

    const response = await request(app).get('/agents').expect(500);

    expect(response.body.error).toContain('CUBICLER_AGENTS_LIST is not defined');
  });
});
