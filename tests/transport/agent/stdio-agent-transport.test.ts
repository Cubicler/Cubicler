import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StdioAgentTransport } from '../../../src/transport/agent/stdio-agent-transport.js';
import type { AgentRequest, AgentResponse } from '../../../src/model/dispatch.js';
import { EventEmitter } from 'events';
import * as envHelper from '../../../src/utils/env-helper.js';

// Mock child_process
const mockChild = new EventEmitter() as any;
mockChild.stdin = {
  write: vi.fn(),
  end: vi.fn(),
};
mockChild.stdout = new EventEmitter();
mockChild.stderr = new EventEmitter();
mockChild.kill = vi.fn();

vi.mock('child_process', () => ({
  spawn: vi.fn(() => mockChild),
}));

// Mock env helper
vi.mock('../../../src/utils/env-helper.js');

describe('StdioAgentTransport', () => {
  const mockConfig = {
    transport: 'stdio' as const,
    name: 'Test Agent',
    description: 'Test stdio agent',
    command: 'python3',
    args: ['/path/to/agent.py', '--config', 'test'],
  };
  let transport: StdioAgentTransport;
  const mockGetAgentCallTimeout = vi.mocked(envHelper.getAgentCallTimeout);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentCallTimeout.mockReturnValue(30000);
    transport = new StdioAgentTransport(mockConfig);
  });

  describe('constructor', () => {
    it('should create transport with valid command', () => {
      expect(transport).toBeInstanceOf(StdioAgentTransport);
    });

    it('should throw error for empty command', () => {
      expect(
        () =>
          new StdioAgentTransport({
            transport: 'stdio',
            name: 'Bad',
            description: 'Missing command',
            command: '',
          } as any)
      ).toThrow('Agent command must be a non-empty string');
    });

    it('should allow whitespace command (no trim validation enforced)', () => {
      const instance = new StdioAgentTransport({
        transport: 'stdio',
        name: 'Whitespace',
        description: 'Whitespace command',
        command: '   ' as any,
      } as any);
      expect(instance).toBeInstanceOf(StdioAgentTransport);
    });

    it('should throw error for non-string command', () => {
      expect(
        () =>
          new StdioAgentTransport({
            transport: 'stdio',
            name: 'Bad',
            description: 'Null',
            command: null as any,
          } as any)
      ).toThrow('Agent command must be a non-empty string');
    });
  });

  describe('call', () => {
    const mockAgentRequest: AgentRequest = {
      agent: {
        identifier: 'test-agent',
        name: 'Test Agent',
        description: 'Test description',
        prompt: 'Test prompt',
      },
      tools: [],
      servers: [],
      messages: [
        {
          sender: { id: 'user1' },
          type: 'text',
          content: 'Hello',
        },
      ],
    };

    const mockAgentResponse: AgentResponse = {
      timestamp: '2025-08-03T10:00:00Z',
      type: 'text',
      content: 'Hello back!',
      metadata: {
        usedToken: 10,
        usedTools: 0,
      },
    };

    it('should call agent successfully', async () => {
      const promise = transport.dispatch(mockAgentRequest);

      // Simulate successful response in JSON-RPC format
      setTimeout(() => {
        // Extract the request ID from what was actually written
        const writtenData = (mockChild.stdin.write as any).mock.calls[0][0];
        const request = JSON.parse(writtenData);
        const requestId = request.id;

        const responseMessage =
          JSON.stringify({
            jsonrpc: '2.0',
            id: requestId,
            result: mockAgentResponse,
          }) + '\n';
        mockChild.stdout.emit('data', responseMessage);
        mockChild.emit('close', 0);
      }, 10);

      const result = await promise;

      expect(mockChild.stdin.write).toHaveBeenCalled();
      const writtenData = (mockChild.stdin.write as any).mock.calls[0][0];
      expect(writtenData).toContain('"jsonrpc":"2.0"');
      expect(writtenData).toContain('"method":"dispatch"');
      expect(result).toEqual(mockAgentResponse);
    });

    it('should handle process exit with non-zero code', async () => {
      const promise = transport.dispatch(mockAgentRequest);

      setTimeout(() => {
        mockChild.stderr.emit('data', 'Process failed');
        mockChild.emit('exit', 1, null);
      }, 10);

      await expect(promise).rejects.toThrow('Agent process exited with code 1');
    });

    it('should handle invalid JSON response', async () => {
      const promise = transport.dispatch(mockAgentRequest);

      setTimeout(() => {
        // Send invalid JSON - this will be ignored and logged as error
        mockChild.stdout.emit('data', 'invalid json\n');
        // Then send a valid JSON-RPC response
        const writtenData = (mockChild.stdin.write as any).mock.calls[0][0];
        const request = JSON.parse(writtenData);
        const requestId = request.id;

        const responseMessage =
          JSON.stringify({
            jsonrpc: '2.0',
            id: requestId,
            result: mockAgentResponse,
          }) + '\n';
        mockChild.stdout.emit('data', responseMessage);
        mockChild.emit('close', 0);
      }, 10);

      const result = await promise;
      expect(result).toEqual(mockAgentResponse);
    });

    it('should handle missing required fields in response', async () => {
      const invalidResponse = {
        timestamp: '2025-08-03T10:00:00Z',
        type: 'text',
        // missing content and metadata
      };

      const promise = transport.dispatch(mockAgentRequest);

      setTimeout(() => {
        const writtenData = (mockChild.stdin.write as any).mock.calls[0][0];
        const request = JSON.parse(writtenData);
        const requestId = request.id;

        const responseMessage =
          JSON.stringify({
            jsonrpc: '2.0',
            id: requestId,
            result: invalidResponse,
          }) + '\n';
        mockChild.stdout.emit('data', responseMessage);
      }, 10);

      await expect(promise).rejects.toThrow(
        'Invalid agent response format: missing required fields (timestamp, type, content, metadata)'
      );
    });

    it('should handle process spawn error', async () => {
      const promise = transport.dispatch(mockAgentRequest);

      setTimeout(() => {
        mockChild.emit('error', new Error('Command not found'));
      }, 10);

      await expect(promise).rejects.toThrow('Agent process error: Command not found');
    });

    it('should handle timeout', async () => {
      mockGetAgentCallTimeout.mockReturnValue(100); // Short timeout
      const transport = new StdioAgentTransport(mockConfig);

      const promise = transport.dispatch(mockAgentRequest);

      // Don't emit any events to trigger timeout
      await expect(promise).rejects.toThrow('Agent call timeout after 100ms');
      // Note: timeout doesn't kill the process, it just rejects the request
    });

    it('should handle process killed by signal', async () => {
      const promise = transport.dispatch(mockAgentRequest);

      setTimeout(() => {
        mockChild.emit('exit', null, 'SIGTERM');
      }, 10);

      await expect(promise).rejects.toThrow('Agent process exited with code null, signal SIGTERM');
    });

    it('should handle stdin write error', async () => {
      vi.mocked(mockChild.stdin.write).mockImplementation(() => {
        throw new Error('Write failed');
      });

      await expect(transport.dispatch(mockAgentRequest)).rejects.toThrow(
        'Failed to write to agent process: Error: Write failed'
      );
    });
  });
});
