import { beforeEach, describe, it, expect, vi } from 'vitest';

describe('Internal Tools Service', () => {
  let internalToolsService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Import the service
    const { default: service } = await import('../../src/core/internal-tools-service.js');
    internalToolsService = service;
  });

  describe('toolsList', () => {
    it('should return list of internal tools', async () => {
      const tools = await internalToolsService.toolsList();

      expect(tools).toHaveLength(2);

      // Check cubicler.available_servers tool
      const availableServersTool = tools.find((t: any) => t.name === 'cubicler.available_servers');
      expect(availableServersTool).toBeDefined();
      expect(availableServersTool?.description).toContain('available servers');
      expect(availableServersTool?.parameters.type).toBe('object');

      // Check cubicler.fetch_server_tools tool
      const fetchServerToolsTool = tools.find((t: any) => t.name === 'cubicler.fetch_server_tools');
      expect(fetchServerToolsTool).toBeDefined();
      expect(fetchServerToolsTool?.description).toContain('tools from one particular server');
      expect(fetchServerToolsTool?.parameters.required).toContain('serverIdentifier');
    });
  });

  describe('identifier', () => {
    it('should return correct identifier', () => {
      expect(internalToolsService.identifier).toBe('cubicler');
    });
  });

  describe('toolsCall', () => {
    it('should throw error for unknown internal tool', async () => {
      await expect(internalToolsService.toolsCall('cubicler.unknown_tool', {})).rejects.toThrow(
        'Unknown internal tool: cubicler.unknown_tool'
      );
    });

    it('should throw error for missing serverIdentifier in fetch_server_tools', async () => {
      await expect(
        internalToolsService.toolsCall('cubicler.fetch_server_tools', {})
      ).rejects.toThrow('Missing required parameter: serverIdentifier');
    });
  });
});
