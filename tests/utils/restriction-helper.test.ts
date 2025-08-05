import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  isServerAllowed,
  isToolAllowed,
  filterAllowedServers,
  filterAllowedTools,
  validateToolAccess,
} from '../../src/utils/restriction-helper.js';
import type { Agent } from '../../src/model/agents.js';
import type { ServersProviding } from '../../src/interface/servers-providing.js';
import type { ServerInfo, AvailableServersResponse } from '../../src/model/server.js';
import type { ToolDefinition } from '../../src/model/tools.js';

describe('Restriction Helper', () => {
  let mockServersProvider: ServersProviding;
  let mockServersResponse: AvailableServersResponse;
  let baseAgent: Agent;

  beforeEach(() => {
    // Create mock servers provider
    mockServersProvider = {
      getAvailableServers: vi.fn(),
      getServerHash: vi.fn(),
    };

    // Mock servers response
    mockServersResponse = {
      total: 3,
      servers: [
        {
          identifier: 'weather_service',
          name: 'Weather Service',
          description: 'Weather information',
          toolsCount: 5,
        },
        {
          identifier: 'news_service',
          name: 'News Service',
          description: 'News aggregation',
          toolsCount: 3,
        },
        {
          identifier: 'calendar_service',
          name: 'Calendar Service',
          description: 'Calendar management',
          toolsCount: 7,
        },
      ],
    };

    // Base agent without restrictions
    baseAgent = {
      identifier: 'test_agent',
      name: 'Test Agent',
      description: 'Test agent for restrictions',
      transport: 'http',
      config: {
        url: 'http://localhost:3000',
      },
    };

    vi.mocked(mockServersProvider.getAvailableServers).mockResolvedValue(mockServersResponse);
  });

  describe('isServerAllowed', () => {
    it('should allow all servers when no restrictions are defined', () => {
      const result = isServerAllowed(baseAgent, 'weather_service');
      expect(result).toBe(true);
    });

    it('should allow only servers in allowedServers list', () => {
      const agentWithAllowed: Agent = {
        ...baseAgent,
        allowedServers: ['weather_service', 'news_service'],
      };

      expect(isServerAllowed(agentWithAllowed, 'weather_service')).toBe(true);
      expect(isServerAllowed(agentWithAllowed, 'news_service')).toBe(true);
      expect(isServerAllowed(agentWithAllowed, 'calendar_service')).toBe(false);
      expect(isServerAllowed(agentWithAllowed, 'unknown_service')).toBe(false);
    });

    it('should deny servers in restrictedServers list', () => {
      const agentWithRestricted: Agent = {
        ...baseAgent,
        restrictedServers: ['calendar_service'],
      };

      expect(isServerAllowed(agentWithRestricted, 'weather_service')).toBe(true);
      expect(isServerAllowed(agentWithRestricted, 'news_service')).toBe(true);
      expect(isServerAllowed(agentWithRestricted, 'calendar_service')).toBe(false);
    });

    it('should apply both allowedServers and restrictedServers filters', () => {
      const agentWithBoth: Agent = {
        ...baseAgent,
        allowedServers: ['weather_service', 'calendar_service'],
        restrictedServers: ['calendar_service'],
      };

      expect(isServerAllowed(agentWithBoth, 'weather_service')).toBe(true);
      expect(isServerAllowed(agentWithBoth, 'calendar_service')).toBe(false); // restricted overrides allowed
      expect(isServerAllowed(agentWithBoth, 'news_service')).toBe(false); // not in allowed
    });

    it('should handle empty allowedServers array as no restrictions', () => {
      const agentWithEmpty: Agent = {
        ...baseAgent,
        allowedServers: [],
      };

      expect(isServerAllowed(agentWithEmpty, 'weather_service')).toBe(true);
      expect(isServerAllowed(agentWithEmpty, 'any_service')).toBe(true);
    });
  });

  describe('isToolAllowed', () => {
    beforeEach(() => {
      // Setup server hash mocks
      vi.mocked(mockServersProvider.getServerHash)
        .mockImplementation(async (identifier: string) => {
          const hashMap: Record<string, string> = {
            weather_service: '1r2dj4',
            news_service: '9k8m3n',
            calendar_service: 'x7y2z5',
          };
          if (identifier in hashMap) {
            return hashMap[identifier];
          }
          throw new Error(`Unknown server: ${identifier}`);
        });
    });

    it('should allow internal tools by default', async () => {
      const result = await isToolAllowed(baseAgent, 'cubicler_available_servers', mockServersProvider);
      expect(result).toBe(true);
    });

    it('should deny restricted internal tools', async () => {
      const agentWithRestrictedInternal: Agent = {
        ...baseAgent,
        restrictedTools: ['cubicler_available_servers'],
      };

      const result = await isToolAllowed(agentWithRestrictedInternal, 'cubicler_available_servers', mockServersProvider);
      expect(result).toBe(false);
    });

    it('should allow external tools when server is allowed', async () => {
      const result = await isToolAllowed(baseAgent, '1r2dj4_get_weather', mockServersProvider);
      expect(result).toBe(true);
    });

    it('should deny external tools when server is not allowed', async () => {
      const agentWithServerRestrictions: Agent = {
        ...baseAgent,
        allowedServers: ['news_service'],
      };

      const result = await isToolAllowed(agentWithServerRestrictions, '1r2dj4_get_weather', mockServersProvider);
      expect(result).toBe(false);
    });

    it('should deny external tools when server is restricted', async () => {
      const agentWithServerRestrictions: Agent = {
        ...baseAgent,
        restrictedServers: ['weather_service'],
      };

      const result = await isToolAllowed(agentWithServerRestrictions, '1r2dj4_get_weather', mockServersProvider);
      expect(result).toBe(false);
    });

    it('should allow only tools in allowedTools list', async () => {
      const agentWithAllowedTools: Agent = {
        ...baseAgent,
        allowedTools: ['weather_service.get_weather', 'news_service.get_headlines'],
      };

      const weatherResult = await isToolAllowed(agentWithAllowedTools, '1r2dj4_get_weather', mockServersProvider);
      const headlinesResult = await isToolAllowed(agentWithAllowedTools, '9k8m3n_get_headlines', mockServersProvider);
      const blockedResult = await isToolAllowed(agentWithAllowedTools, '1r2dj4_get_forecast', mockServersProvider);

      expect(weatherResult).toBe(true);
      expect(headlinesResult).toBe(true);
      expect(blockedResult).toBe(false);
    });

    it('should deny tools in restrictedTools list', async () => {
      const agentWithRestrictedTools: Agent = {
        ...baseAgent,
        restrictedTools: ['weather_service.get_forecast'],
      };

      const allowedResult = await isToolAllowed(agentWithRestrictedTools, '1r2dj4_get_weather', mockServersProvider);
      const restrictedResult = await isToolAllowed(agentWithRestrictedTools, '1r2dj4_get_forecast', mockServersProvider);

      expect(allowedResult).toBe(true);
      expect(restrictedResult).toBe(false);
    });

    it('should handle invalid tool name format', async () => {
      const result = await isToolAllowed(baseAgent, 'invalid_format', mockServersProvider);
      expect(result).toBe(false);
    });

    it('should handle unknown server hash', async () => {
      const result = await isToolAllowed(baseAgent, 'unknown_get_data', mockServersProvider);
      expect(result).toBe(false);
    });

    it('should handle server provider errors gracefully', async () => {
      vi.mocked(mockServersProvider.getAvailableServers).mockRejectedValue(new Error('Network error'));

      const result = await isToolAllowed(baseAgent, '1r2dj4_get_weather', mockServersProvider);
      expect(result).toBe(false);
    });

    it('should handle getServerHash errors gracefully', async () => {
      vi.mocked(mockServersProvider.getServerHash).mockRejectedValue(new Error('Hash error'));

      const result = await isToolAllowed(baseAgent, '1r2dj4_get_weather', mockServersProvider);
      expect(result).toBe(false);
    });
  });

  describe('filterAllowedServers', () => {
    it('should return all servers when no restrictions', () => {
      const result = filterAllowedServers(baseAgent, mockServersResponse.servers);
      expect(result).toHaveLength(3);
      expect(result).toEqual(mockServersResponse.servers);
    });

    it('should filter by allowedServers', () => {
      const agentWithAllowed: Agent = {
        ...baseAgent,
        allowedServers: ['weather_service', 'news_service'],
      };

      const result = filterAllowedServers(agentWithAllowed, mockServersResponse.servers);
      expect(result).toHaveLength(2);
      expect(result[0].identifier).toBe('weather_service');
      expect(result[1].identifier).toBe('news_service');
    });

    it('should exclude restrictedServers', () => {
      const agentWithRestricted: Agent = {
        ...baseAgent,
        restrictedServers: ['calendar_service'],
      };

      const result = filterAllowedServers(agentWithRestricted, mockServersResponse.servers);
      expect(result).toHaveLength(2);
      expect(result.find(s => s.identifier === 'calendar_service')).toBeUndefined();
    });

    it('should handle empty server list', () => {
      const result = filterAllowedServers(baseAgent, []);
      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });
  });

  describe('filterAllowedTools', () => {
    let mockTools: ToolDefinition[];

    beforeEach(() => {
      mockTools = [
        {
          name: 'cubicler_available_servers',
          description: 'Get available servers',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: '1r2dj4_get_weather',
          description: 'Get weather information',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: '9k8m3n_get_headlines',
          description: 'Get news headlines',
          parameters: { type: 'object', properties: {} },
        },
      ];

      // Setup server hash mocks
      vi.mocked(mockServersProvider.getServerHash)
        .mockImplementation(async (identifier: string) => {
          const hashMap: Record<string, string> = {
            weather_service: '1r2dj4',
            news_service: '9k8m3n',
            calendar_service: 'x7y2z5',
          };
          if (identifier in hashMap) {
            return hashMap[identifier];
          }
          throw new Error(`Unknown server: ${identifier}`);
        });
    });

    it('should return all tools when no restrictions', async () => {
      const result = await filterAllowedTools(baseAgent, mockTools, mockServersProvider);
      expect(result).toHaveLength(3);
      expect(result).toEqual(mockTools);
    });

    it('should filter by server restrictions', async () => {
      const agentWithServerRestrictions: Agent = {
        ...baseAgent,
        allowedServers: ['weather_service'],
      };

      const result = await filterAllowedTools(agentWithServerRestrictions, mockTools, mockServersProvider);
      expect(result).toHaveLength(2); // cubicler tool + weather tool
      expect(result.find(t => t.name === 'cubicler_available_servers')).toBeDefined();
      expect(result.find(t => t.name === '1r2dj4_get_weather')).toBeDefined();
      expect(result.find(t => t.name === '9k8m3n_get_headlines')).toBeUndefined();
    });

    it('should filter by tool restrictions', async () => {
      const agentWithToolRestrictions: Agent = {
        ...baseAgent,
        restrictedTools: ['cubicler_available_servers', 'weather_service.get_weather'],
      };

      const result = await filterAllowedTools(agentWithToolRestrictions, mockTools, mockServersProvider);
      expect(result).toHaveLength(1); // only news tool
      expect(result.find(t => t.name === '9k8m3n_get_headlines')).toBeDefined();
    });

    it('should handle empty tools list', async () => {
      const result = await filterAllowedTools(baseAgent, [], mockServersProvider);
      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });
  });

  describe('validateToolAccess', () => {
    beforeEach(() => {
      // Setup server hash mocks
      vi.mocked(mockServersProvider.getServerHash)
        .mockImplementation(async (identifier: string) => {
          const hashMap: Record<string, string> = {
            weather_service: '1r2dj4',
            news_service: '9k8m3n',
          };
          if (identifier in hashMap) {
            return hashMap[identifier];
          }
          throw new Error(`Unknown server: ${identifier}`);
        });
    });

    it('should not throw for allowed tools', async () => {
      await expect(validateToolAccess(baseAgent, 'cubicler_available_servers', mockServersProvider))
        .resolves.not.toThrow();

      await expect(validateToolAccess(baseAgent, '1r2dj4_get_weather', mockServersProvider))
        .resolves.not.toThrow();
    });

    it('should throw for restricted tools', async () => {
      const agentWithRestrictions: Agent = {
        ...baseAgent,
        restrictedTools: ['cubicler_available_servers'],
      };

      await expect(validateToolAccess(agentWithRestrictions, 'cubicler_available_servers', mockServersProvider))
        .rejects.toThrow('Access denied: insufficient permissions for requested operation');
    });

    it('should throw for tools from restricted servers', async () => {
      const agentWithServerRestrictions: Agent = {
        ...baseAgent,
        restrictedServers: ['weather_service'],
      };

      await expect(validateToolAccess(agentWithServerRestrictions, '1r2dj4_get_weather', mockServersProvider))
        .rejects.toThrow('Access denied: insufficient permissions for requested operation');
    });

    it('should throw for invalid tool names', async () => {
      await expect(validateToolAccess(baseAgent, 'invalid_format', mockServersProvider))
        .rejects.toThrow('Access denied: insufficient permissions for requested operation');
    });
  });
});
