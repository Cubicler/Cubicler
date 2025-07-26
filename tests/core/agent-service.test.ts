import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import type { AgentsList } from '../../src/model/types.js';

// Mock fs and axios modules
const mockReadFileSync = vi.fn();
const mockIsAxiosError = vi.fn().mockReturnValue(true);
const mockAxios = Object.assign(vi.fn(), {
  isAxiosError: mockIsAxiosError
});

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync
}));

vi.mock('axios', () => ({
  default: mockAxios,
  isAxiosError: mockIsAxiosError,
}));

describe('Agent Service', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.AGENTS_LIST_CACHE_ENABLED = 'false'; // Disable cache for tests
    vi.clearAllMocks();
    
    // Clear the agent service cache
    const { default: agentService } = await import('../../src/core/agent-service.js');
    agentService.clearCache();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getAvailableAgents', () => {
    it('should return list of agent names', async () => {
      const mockAgentsList: AgentsList = {
        version: 1,
        kind: 'agents',
        agents: [
          { name: 'gpt-4o', endpoints: 'localhost:3000/call' },
          { name: 'claude-3.5', endpoints: 'localhost:3001/call' }
        ]
      };

      process.env.CUBICLER_AGENTS_LIST = './test-agents.yaml';
      mockReadFileSync.mockReturnValue('version: 1\nkind: agents\nagents:\n  - name: gpt-4o\n    endpoints: localhost:3000/call\n  - name: claude-3.5\n    endpoints: localhost:3001/call');

      const { default: agentService } = await import('../../src/core/agent-service.js');
      const result = await agentService.getAvailableAgents();

      expect(result).toEqual(['gpt-4o', 'claude-3.5']);
      expect(mockReadFileSync).toHaveBeenCalledWith('./test-agents.yaml', 'utf-8');
    });

    it('should fetch agents list from HTTP URL', async () => {
      const mockAgentsList = {
        version: 1,
        kind: 'agents',
        agents: [
          { name: 'gemini-1.5', endpoints: 'localhost:3002/call' }
        ]
      };

      process.env.CUBICLER_AGENTS_LIST = 'https://example.com/agents.yaml';
      mockAxios.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: 'version: 1\nkind: agents\nagents:\n  - name: gemini-1.5\n    endpoints: localhost:3002/call'
      });

      const { default: agentService } = await import('../../src/core/agent-service.js');
      const result = await agentService.getAvailableAgents();

      expect(result).toEqual(['gemini-1.5']);
      expect(mockAxios).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://example.com/agents.yaml',
        timeout: expect.any(Number)
      }));
    });

    it('should throw error when no agents are available', async () => {
      const mockAgentsList: AgentsList = {
        version: 1,
        kind: 'agents',
        agents: []
      };

      process.env.CUBICLER_AGENTS_LIST = './empty-agents.yaml';
      mockReadFileSync.mockReturnValue('version: 1\nkind: agents\nagents: []');

      const { default: agentService } = await import('../../src/core/agent-service.js');
      await expect(agentService.getAvailableAgents()).rejects.toThrow('No agents available in the agents list');
    });

    it('should throw error when CUBICLER_AGENTS_LIST is not defined', async () => {
      delete process.env.CUBICLER_AGENTS_LIST;

      const { default: agentService } = await import('../../src/core/agent-service.js');
      await expect(agentService.getAvailableAgents()).rejects.toThrow('CUBICLER_AGENTS_LIST is not defined in environment variables');
    });

    it('should throw error when agents YAML has wrong kind', async () => {
      process.env.CUBICLER_AGENTS_LIST = './wrong-kind.yaml';
      mockReadFileSync.mockReturnValue('version: 1\nkind: providers\nagents: []');

      const { default: agentService } = await import('../../src/core/agent-service.js');
      await expect(agentService.getAvailableAgents()).rejects.toThrow('Invalid agents YAML: kind must be "agents"');
    });

    it('should throw error when HTTP fetch fails', async () => {
      process.env.CUBICLER_AGENTS_LIST = 'https://example.com/agents.yaml';
      const error = {
        isAxiosError: true,
        response: {
          status: 404,
          statusText: 'Not Found'
        }
      };
      mockAxios.mockRejectedValue(error);

      const { default: agentService } = await import('../../src/core/agent-service.js');
      await expect(agentService.getAvailableAgents()).rejects.toThrow('Failed to fetch agents list: Not Found');
    });
  });

  describe('clearCache', () => {
    it('should clear the cache without throwing', async () => {
      const { default: agentService } = await import('../../src/core/agent-service.js');
      expect(() => agentService.clearCache()).not.toThrow();
    });
  });
});
