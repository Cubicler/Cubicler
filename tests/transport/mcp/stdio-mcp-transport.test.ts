import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MCPRequest } from '../../../src/model/types.js';
import type { StdioMcpServerConfig } from '../../../src/model/providers.js';
import { StdioMCPTransport } from '../../../src/transport/mcp/stdio-mcp-transport.js';
import { spawn } from 'child_process';

// Mock dependencies
vi.mock('child_process');

const mockedSpawn = vi.mocked(spawn);

describe('StdioMCPTransport', () => {
  let transport: StdioMCPTransport;
  let serverId: string;
  let mockConfig: StdioMcpServerConfig;
  let mockProcess: any;

  beforeEach(() => {
    vi.clearAllMocks();

    serverId = 'test-stdio-server';
    mockConfig = {
      name: 'Test Stdio Server',
      description: 'Test stdio MCP server',
      command: 'node',
      args: ['server.js'],
    };

    mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
      killed: false,
      pid: 12345,
    };

    mockedSpawn.mockReturnValue(mockProcess as any);
    transport = new StdioMCPTransport();
  });

  // Transport type validation removed in new schema

  it('should throw error for missing command', async () => {
    const invalidConfig: any = { ...mockConfig };
    delete invalidConfig.command;
    await expect(transport.initialize(serverId, invalidConfig)).rejects.toThrow(
      'Stdio transport requires command for server test-stdio-server'
    );
  });

  it('should return false when not initialized', () => {
    expect(transport.isConnected()).toBe(false);
  });

  it('should return unknown when not initialized', () => {
    expect(transport.getServerIdentifier()).toBe('unknown');
  });

  it('should handle close when not initialized', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await transport.close();
    expect(consoleSpy).toHaveBeenCalledWith('🔄 [StdioMCPTransport] Stdio transport closed');
    consoleSpy.mockRestore();
  });

  it('should throw error when sending request without initialization', async () => {
    const request: MCPRequest = { jsonrpc: '2.0', id: 1, method: 'test' };
    await expect(transport.sendRequest(request)).rejects.toThrow('Stdio transport not initialized');
  });
});
