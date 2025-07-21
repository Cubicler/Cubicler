import { jest } from '@jest/globals';
import agentService from '../../src/core/agent-service.js';
import type { AgentsList } from '../../src/model/types.js';

// Mock fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn()
}));

// Mock fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('Agent Service', () => {
  const originalEnv = process.env;
  const mockReadFileSync = require('fs').readFileSync as jest.MockedFunction<typeof import('fs').readFileSync>;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.AGENTS_LIST_CACHE_ENABLED = 'false'; // Disable cache for tests
    jest.clearAllMocks();
    
    // Clear the agent service cache
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
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'version: 1\nkind: agents\nagents:\n  - name: gemini-1.5\n    endpoints: localhost:3002/call'
      } as Response);

      const result = await agentService.getAvailableAgents();

      expect(result).toEqual(['gemini-1.5']);
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/agents.yaml');
    });

    it('should throw error when no agents are available', async () => {
      const mockAgentsList: AgentsList = {
        version: 1,
        kind: 'agents',
        agents: []
      };

      process.env.CUBICLER_AGENTS_LIST = './empty-agents.yaml';
      mockReadFileSync.mockReturnValue('version: 1\nkind: agents\nagents: []');

      await expect(agentService.getAvailableAgents()).rejects.toThrow('No agents available in the agents list');
    });

    it('should throw error when CUBICLER_AGENTS_LIST is not defined', async () => {
      delete process.env.CUBICLER_AGENTS_LIST;

      await expect(agentService.getAvailableAgents()).rejects.toThrow('CUBICLER_AGENTS_LIST is not defined in environment variables');
    });

    it('should throw error when agents YAML has wrong kind', async () => {
      process.env.CUBICLER_AGENTS_LIST = './wrong-kind.yaml';
      mockReadFileSync.mockReturnValue('version: 1\nkind: providers\nagents: []');

      await expect(agentService.getAvailableAgents()).rejects.toThrow('Invalid agents YAML: kind must be "agents"');
    });

    it('should throw error when HTTP fetch fails', async () => {
      process.env.CUBICLER_AGENTS_LIST = 'https://example.com/agents.yaml';
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      } as Response);

      await expect(agentService.getAvailableAgents()).rejects.toThrow('Failed to fetch agents list: Not Found');
    });
  });

  describe('clearCache', () => {
    it('should clear the cache without throwing', () => {
      expect(() => agentService.clearCache()).not.toThrow();
    });
  });
});
