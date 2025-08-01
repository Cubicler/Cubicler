import { beforeEach, describe, it, expect, vi } from 'vitest';
import { AgentService } from '../../src/core/agent-service.js';
import type { AgentsConfigProviding } from '../../src/interface/agents-config-providing.js';
import type { ServersProviding } from '../../src/interface/servers-providing.js';
import type { AgentsConfig } from '../../src/model/agents.js';
import type { AvailableServersResponse } from '../../src/model/tools.js';

describe('Agent Service', () => {
  let agentService: AgentService;
  let mockAgentsConfigProvider: AgentsConfigProviding;
  let mockServersProvider: ServersProviding;

  beforeEach(() => {
    // Create mock providers
    mockAgentsConfigProvider = {
      getAgentsConfig: vi.fn(),
    };

    mockServersProvider = {
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
    };

    // Create service instance with mocked dependencies
    agentService = new AgentService(mockServersProvider, mockAgentsConfigProvider);
  });

  describe('getAllAgents', () => {
    it('should return list of available agents', async () => {
      const mockConfig: AgentsConfig = {
        basePrompt: 'You are a helpful AI assistant.',
        defaultPrompt: 'You have access to tools.',
        agents: [
          {
            identifier: 'gpt_4o',
            name: 'GPT-4O',
            transport: 'http',
            url: 'http://localhost:3000',
            description: 'Advanced agent',
          },
          {
            identifier: 'claude_3_5',
            name: 'Claude',
            transport: 'http',
            url: 'http://localhost:3001',
            description: 'Creative agent',
          },
        ],
      };

      vi.mocked(mockAgentsConfigProvider.getAgentsConfig).mockResolvedValue(mockConfig);

      const result = await agentService.getAllAgents();

      expect(result).toHaveLength(2);
      expect(result.map((a) => a.identifier)).toEqual(['gpt_4o', 'claude_3_5']);
      expect(result[0]).toEqual({
        identifier: 'gpt_4o',
        name: 'GPT-4O',
        description: 'Advanced agent',
      });
    });

    it('should handle empty agents list', async () => {
      const mockConfig: AgentsConfig = {
        agents: [],
      };

      vi.mocked(mockAgentsConfigProvider.getAgentsConfig).mockResolvedValue(mockConfig);

      const result = await agentService.getAllAgents();

      expect(result).toHaveLength(0);
    });
  });

  describe('hasAgent', () => {
    const mockConfig: AgentsConfig = {
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
    };

    beforeEach(() => {
      vi.mocked(mockAgentsConfigProvider.getAgentsConfig).mockResolvedValue(mockConfig);
    });

    it('should return true for existing agent', async () => {
      const result = await agentService.hasAgent('gpt_4o');
      expect(result).toBe(true);
    });

    it('should return false for non-existent agent', async () => {
      const result = await agentService.hasAgent('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('getAgentInfo', () => {
    const mockConfig: AgentsConfig = {
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
    };

    beforeEach(() => {
      vi.mocked(mockAgentsConfigProvider.getAgentsConfig).mockResolvedValue(mockConfig);
    });

    it('should return specific agent info by identifier', async () => {
      const result = await agentService.getAgentInfo('gpt_4o');

      expect(result.identifier).toBe('gpt_4o');
      expect(result.name).toBe('GPT-4O');
      expect(result.description).toBe('Advanced agent');
    });

    it('should return default agent info when no identifier provided', async () => {
      const result = await agentService.getAgentInfo();

      expect(result.identifier).toBe('gpt_4o'); // First agent is default
    });
  });

  describe('getAgentPrompt', () => {
    const mockServersResponse: AvailableServersResponse = {
      total: 2,
      servers: [
        {
          identifier: 'weather_service',
          name: 'Weather Service',
          description: 'Provides weather information',
          toolsCount: 3,
        },
        {
          identifier: 'search_service',
          name: 'Search Service',
          description: 'Provides search capabilities',
          toolsCount: 2,
        },
      ],
    };

    beforeEach(() => {
      vi.mocked(mockServersProvider.getAvailableServers).mockResolvedValue(mockServersResponse);
    });

    it('should compose prompt with base + agent-specific prompt', async () => {
      const mockConfig: AgentsConfig = {
        basePrompt: 'You are a helpful AI assistant.',
        defaultPrompt: 'You have access to tools.',
        agents: [
          {
            identifier: 'agent_with_prompt',
            name: 'Agent With Prompt',
            transport: 'http',
            url: 'http://localhost:3000',
            description: 'Specialized agent',
            prompt: 'You are specialized in analysis.',
          },
          {
            identifier: 'agent_without_prompt',
            name: 'Agent Without Prompt',
            transport: 'http',
            url: 'http://localhost:3001',
            description: 'General agent',
          },
        ],
      };

      vi.mocked(mockAgentsConfigProvider.getAgentsConfig).mockResolvedValue(mockConfig);

      const result = await agentService.getAgentPrompt('agent_with_prompt');

      expect(result).toContain('You are a helpful AI assistant.');
      expect(result).toContain('You are specialized in analysis.');
      expect(result).toContain('## Available Services');
      expect(result).toContain('Weather Service (weather_service)');
    });

    it('should compose prompt with base + default prompt when agent has no specific prompt', async () => {
      const mockConfig: AgentsConfig = {
        basePrompt: 'You are a helpful AI assistant.',
        defaultPrompt: 'You have access to tools.',
        agents: [
          {
            identifier: 'agent_without_prompt',
            name: 'Agent Without Prompt',
            transport: 'http',
            url: 'http://localhost:3001',
            description: 'General agent',
          },
        ],
      };

      vi.mocked(mockAgentsConfigProvider.getAgentsConfig).mockResolvedValue(mockConfig);

      const result = await agentService.getAgentPrompt('agent_without_prompt');

      expect(result).toContain('You are a helpful AI assistant.');
      expect(result).toContain('You have access to tools.');
      expect(result).toContain('## Available Services');
    });

    it('should use default agent when no agent identifier provided', async () => {
      const mockConfig: AgentsConfig = {
        basePrompt: 'You are a helpful AI assistant.',
        defaultPrompt: 'You have access to tools.',
        agents: [
          {
            identifier: 'first_agent',
            name: 'First Agent',
            transport: 'http',
            url: 'http://localhost:3000',
            description: 'First agent',
            prompt: 'You are specialized in analysis.',
          },
        ],
      };

      vi.mocked(mockAgentsConfigProvider.getAgentsConfig).mockResolvedValue(mockConfig);

      const result = await agentService.getAgentPrompt();

      expect(result).toContain('You are a helpful AI assistant.');
      expect(result).toContain('You are specialized in analysis.');
    });

    it('should handle missing base prompt', async () => {
      const mockConfig: AgentsConfig = {
        defaultPrompt: 'You have access to tools.',
        agents: [
          {
            identifier: 'test_agent',
            name: 'Test Agent',
            transport: 'http',
            url: 'http://localhost:3000',
            description: 'Test agent',
            prompt: 'You are specialized.',
          },
        ],
      };

      vi.mocked(mockAgentsConfigProvider.getAgentsConfig).mockResolvedValue(mockConfig);

      const result = await agentService.getAgentPrompt('test_agent');

      expect(result).toContain('You are specialized.');
      expect(result).not.toContain('You are a helpful AI assistant.');
    });

    it('should handle case when servers provider fails', async () => {
      const mockConfig: AgentsConfig = {
        basePrompt: 'You are a helpful AI assistant.',
        agents: [
          {
            identifier: 'test_agent',
            name: 'Test Agent',
            transport: 'http',
            url: 'http://localhost:3000',
            description: 'Test agent',
          },
        ],
      };

      vi.mocked(mockAgentsConfigProvider.getAgentsConfig).mockResolvedValue(mockConfig);
      vi.mocked(mockServersProvider.getAvailableServers).mockRejectedValue(new Error('Server error'));

      const result = await agentService.getAgentPrompt('test_agent');

      expect(result).toContain('You are a helpful AI assistant.');
      expect(result).not.toContain('## Available Services');
    });

    it('should return minimal default when no prompts configured', async () => {
      const mockConfig: AgentsConfig = {
        agents: [
          {
            identifier: 'minimal_agent',
            name: 'Minimal Agent',
            transport: 'http',
            url: 'http://localhost:3000',
            description: 'Minimal agent',
          },
        ],
      };

      vi.mocked(mockAgentsConfigProvider.getAgentsConfig).mockResolvedValue(mockConfig);
      vi.mocked(mockServersProvider.getAvailableServers).mockResolvedValue({ total: 0, servers: [] });

      const result = await agentService.getAgentPrompt('minimal_agent');

      expect(result).toBe('You are a helpful AI assistant powered by Cubicler.');
    });
  });
});
