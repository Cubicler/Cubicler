import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import axios from 'axios';

// Mock fs and axios modules
vi.mock('fs');
vi.mock('axios');

const mockFs = vi.mocked(fs);
const mockAxios = vi.mocked(axios, { partial: true });

describe('Agent Service', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.AGENTS_LIST_CACHE_ENABLED = 'false'; // Disable cache for tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getAllAgents', () => {
    it('should return list of available agents', async () => {
      process.env.CUBICLER_AGENTS_LIST = './test-agents.json';
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          basePrompt: 'You are a helpful AI assistant.',
          defaultPrompt: 'You have access to tools.',
          agents: [
            {
              identifier: 'gpt_4o',
              name: 'GPT-4O',
              transport: 'http',
              url: 'http://localhost:3000',
            },
            {
              identifier: 'claude_3_5',
              name: 'Claude',
              transport: 'http',
              url: 'http://localhost:3001',
            },
          ],
        })
      );

      const { default: agentService } = await import('../../src/core/agent-service.js');
      const result = await agentService.getAllAgents();

      expect(result).toHaveLength(2);
      expect(result.map((a) => a.identifier)).toEqual(['gpt_4o', 'claude_3_5']);
    });

    it('should load agents from remote URL', async () => {
      process.env.CUBICLER_AGENTS_LIST = 'https://example.com/agents.json';
      mockAxios.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: {
          agents: [
            {
              identifier: 'remote_agent',
              name: 'Remote Agent',
              transport: 'http',
              url: 'http://remote:3000',
              description: 'Remote agent',
            },
          ],
        },
      });

      const { default: agentService } = await import('../../src/core/agent-service.js');
      const result = await agentService.getAllAgents();

      expect(result).toHaveLength(1);
      expect(result[0].identifier).toBe('remote_agent');
      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com/agents.json',
        })
      );
    });

    it('should handle empty agents list', async () => {
      process.env.CUBICLER_AGENTS_LIST = './empty-agents.json';
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ agents: [] }));

      const { default: agentService } = await import('../../src/core/agent-service.js');

      await expect(agentService.getAllAgents()).rejects.toThrow(
        'Invalid agents configuration: at least one agent must be configured'
      );
    });
  });

  describe('hasAgent', () => {
    beforeEach(() => {
      process.env.CUBICLER_AGENTS_LIST = './test-agents.json';
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          basePrompt: 'You are a helpful AI assistant.',
          defaultPrompt: 'You have access to tools.',
          agents: [
            {
              identifier: 'gpt_4o',
              name: 'GPT-4O',
              transport: 'http',
              url: 'http://localhost:3000',
              description: 'Advanced agent',
              prompt: 'You are specialized.',
            },
            {
              identifier: 'claude_3_5',
              name: 'Claude',
              transport: 'http',
              url: 'http://localhost:3001',
              description: 'Creative agent',
            },
          ],
        })
      );
    });

    it('should return true for existing agent', async () => {
      const { default: agentService } = await import('../../src/core/agent-service.js');
      const result = await agentService.hasAgent('gpt_4o');

      expect(result).toBe(true);
    });

    it('should return false for non-existent agent', async () => {
      const { default: agentService } = await import('../../src/core/agent-service.js');
      const result = await agentService.hasAgent('non_existent');

      expect(result).toBe(false);
    });
  });

  describe('getAgentInfo', () => {
    beforeEach(() => {
      process.env.CUBICLER_AGENTS_LIST = './test-agents.json';
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          basePrompt: 'You are a helpful AI assistant.',
          defaultPrompt: 'You have access to tools.',
          agents: [
            {
              identifier: 'gpt_4o',
              name: 'GPT-4O',
              transport: 'http',
              url: 'http://localhost:3000',
              description: 'Advanced agent',
              prompt: 'You are specialized.',
            },
            {
              identifier: 'claude_3_5',
              name: 'Claude',
              transport: 'http',
              url: 'http://localhost:3001',
              description: 'Creative agent',
            },
          ],
        })
      );
    });

    it('should return specific agent info by identifier', async () => {
      const { default: agentService } = await import('../../src/core/agent-service.js');
      const result = await agentService.getAgentInfo('gpt_4o');

      expect(result.identifier).toBe('gpt_4o');
      expect(result.name).toBe('GPT-4O');
      expect(result.description).toBe('Advanced agent');
    });

    it('should return default agent info when no identifier provided', async () => {
      const { default: agentService } = await import('../../src/core/agent-service.js');
      const result = await agentService.getAgentInfo();

      expect(result.identifier).toBe('gpt_4o'); // First agent is default
    });
  });

  describe('getAgentPrompt', () => {
    beforeEach(() => {
      process.env.CUBICLER_AGENTS_LIST = './test-agents.json';
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          basePrompt: 'You are a helpful AI assistant.',
          defaultPrompt: 'You have access to tools.',
          agents: [
            {
              identifier: 'agent_with_prompt',
              name: 'Agent With Prompt',
              transport: 'http',
              url: 'http://localhost:3000',
              prompt: 'You are specialized in analysis.',
            },
            {
              identifier: 'agent_without_prompt',
              name: 'Agent Without Prompt',
              transport: 'http',
              url: 'http://localhost:3001',
            },
          ],
        })
      );
    });

    it('should compose prompt with base + agent-specific prompt', async () => {
      const { default: agentService } = await import('../../src/core/agent-service.js');
      const result = await agentService.getAgentPrompt('agent_with_prompt');

      expect(result).toBe('You are a helpful AI assistant.\n\nYou are specialized in analysis.');
    });

    it('should compose prompt with base + default prompt when agent has no specific prompt', async () => {
      const { default: agentService } = await import('../../src/core/agent-service.js');
      const result = await agentService.getAgentPrompt('agent_without_prompt');

      expect(result).toBe('You are a helpful AI assistant.\n\nYou have access to tools.');
    });

    it('should use default agent when no agent identifier provided', async () => {
      const { default: agentService } = await import('../../src/core/agent-service.js');
      const result = await agentService.getAgentPrompt();

      expect(result).toBe('You are a helpful AI assistant.\n\nYou are specialized in analysis.'); // First agent has specific prompt
    });

    it('should handle missing base prompt', async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          defaultPrompt: 'You have access to tools.',
          agents: [
            {
              identifier: 'test_agent',
              name: 'Test Agent',
              transport: 'http',
              url: 'http://localhost:3000',
              prompt: 'You are specialized.',
            },
          ],
        })
      );

      const { default: agentService } = await import('../../src/core/agent-service.js');
      const result = await agentService.getAgentPrompt('test_agent');

      expect(result).toBe('You are specialized.');
    });
  });
});
