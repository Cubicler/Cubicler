import { beforeEach, describe, it, expect, vi } from 'vitest';
import { HealthService } from '../../src/core/health-service.js';
import type { AgentsProviding } from '../../src/interface/agents-providing.js';
import type { ServersProviding } from '../../src/interface/servers-providing.js';
import type { AgentInfo } from '../../src/model/agents.js';
import type { AvailableServersResponse } from '../../src/model/server.js';

describe('Health Service', () => {
  let healthService: HealthService;
  let mockAgentsProvider: AgentsProviding;
  let mockServersProvider: ServersProviding;

  beforeEach(() => {
    // Create mock providers
    mockAgentsProvider = {
      getAllAgents: vi.fn(),
      hasAgent: vi.fn(),
      getAgentInfo: vi.fn(),
      getAgentPrompt: vi.fn(),
      getAgentUrl: vi.fn(),
      getAgent: vi.fn(),
    };

    mockServersProvider = {
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
    };

    // Create service instance with mocked dependencies
    healthService = new HealthService(mockAgentsProvider, mockServersProvider);
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all services are working', async () => {
      const mockAgents: AgentInfo[] = [
        { identifier: 'gpt_4o', name: 'GPT-4O', description: 'Advanced agent' },
        { identifier: 'claude_3_5', name: 'Claude', description: 'Creative agent' },
      ];

      const mockServers: AvailableServersResponse = {
        total: 2,
        servers: [
          {
            identifier: 'weather_service',
            name: 'Weather Service',
            description: 'Weather info',
            toolsCount: 3,
          },
          {
            identifier: 'search_service',
            name: 'Search Service',
            description: 'Search capabilities',
            toolsCount: 2,
          },
        ],
      };

      vi.mocked(mockAgentsProvider.getAllAgents).mockResolvedValue(mockAgents);
      vi.mocked(mockServersProvider.getAvailableServers).mockResolvedValue(mockServers);

      const result = await healthService.getHealthStatus();

      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(result.services.agents).toEqual({
        status: 'healthy',
        count: 2,
        agents: ['gpt_4o', 'claude_3_5'],
      });
      expect(result.services.providers).toEqual({
        status: 'healthy',
        count: 2,
        servers: ['weather_service', 'search_service'],
      });
      expect(result.services.mcp).toEqual({ status: 'healthy' });
    });

    it('should return unhealthy status when agents service fails', async () => {
      const mockServers: AvailableServersResponse = {
        total: 1,
        servers: [
          {
            identifier: 'weather_service',
            name: 'Weather Service',
            description: 'Weather info',
            toolsCount: 3,
          },
        ],
      };

      vi.mocked(mockAgentsProvider.getAllAgents).mockRejectedValue(
        new Error('Agents service unavailable')
      );
      vi.mocked(mockServersProvider.getAvailableServers).mockResolvedValue(mockServers);

      const result = await healthService.getHealthStatus();

      expect(result.status).toBe('unhealthy');
      expect(result.services.agents).toEqual({
        status: 'unhealthy',
        error: 'Agents service unavailable',
      });
      expect(result.services.providers).toEqual({
        status: 'healthy',
        count: 1,
        servers: ['weather_service'],
      });
    });

    it('should return unhealthy status when providers service fails', async () => {
      const mockAgents: AgentInfo[] = [
        { identifier: 'gpt_4o', name: 'GPT-4O', description: 'Advanced agent' },
      ];

      vi.mocked(mockAgentsProvider.getAllAgents).mockResolvedValue(mockAgents);
      vi.mocked(mockServersProvider.getAvailableServers).mockRejectedValue(
        new Error('Providers service unavailable')
      );

      const result = await healthService.getHealthStatus();

      expect(result.status).toBe('unhealthy');
      expect(result.services.agents).toEqual({
        status: 'healthy',
        count: 1,
        agents: ['gpt_4o'],
      });
      expect(result.services.providers).toEqual({
        status: 'unhealthy',
        error: 'Providers service unavailable',
      });
    });

    it('should return unhealthy status when both services fail', async () => {
      vi.mocked(mockAgentsProvider.getAllAgents).mockRejectedValue(
        new Error('Agents service error')
      );
      vi.mocked(mockServersProvider.getAvailableServers).mockRejectedValue(
        new Error('Providers service error')
      );

      const result = await healthService.getHealthStatus();

      expect(result.status).toBe('unhealthy');
      expect(result.services.agents).toEqual({
        status: 'unhealthy',
        error: 'Agents service error',
      });
      expect(result.services.providers).toEqual({
        status: 'unhealthy',
        error: 'Providers service error',
      });
    });

    it('should handle non-Error exceptions gracefully', async () => {
      vi.mocked(mockAgentsProvider.getAllAgents).mockRejectedValue('String error');
      vi.mocked(mockServersProvider.getAvailableServers).mockRejectedValue(null);

      const result = await healthService.getHealthStatus();

      expect(result.status).toBe('unhealthy');
      expect(result.services.agents).toEqual({
        status: 'unhealthy',
        error: 'Unknown error',
      });
      expect(result.services.providers).toEqual({
        status: 'unhealthy',
        error: 'Unknown error',
      });
    });

    it('should always include MCP service as healthy', async () => {
      const mockAgents: AgentInfo[] = [];
      const mockServers: AvailableServersResponse = { total: 0, servers: [] };

      vi.mocked(mockAgentsProvider.getAllAgents).mockResolvedValue(mockAgents);
      vi.mocked(mockServersProvider.getAvailableServers).mockResolvedValue(mockServers);

      const result = await healthService.getHealthStatus();

      expect(result.status).toBe('healthy');
      expect(result.services.mcp).toEqual({ status: 'healthy' });
    });
  });
});
