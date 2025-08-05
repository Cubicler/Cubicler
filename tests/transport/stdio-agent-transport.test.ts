import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StdioAgentTransport } from '../../src/transport/stdio-agent-transport.js';
import type { AgentRequest, AgentResponse } from '../../src/model/dispatch.js';
import { EventEmitter } from 'events';
import * as envHelper from '../../src/utils/env-helper.js';

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
vi.mock('../../src/utils/env-helper.js');

describe('StdioAgentTransport', () => {
  const mockCommand = 'python3 /path/to/agent.py --config test';
  let transport: StdioAgentTransport;
  const mockGetAgentCallTimeout = vi.mocked(envHelper.getAgentCallTimeout);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentCallTimeout.mockReturnValue(30000);
    transport = new StdioAgentTransport(mockCommand);
  });

  describe('constructor', () => {
    it('should create transport with valid command', () => {
      expect(transport).toBeInstanceOf(StdioAgentTransport);
    });

    it('should throw error for empty command', () => {
      expect(() => new StdioAgentTransport('')).toThrow('Agent command must be a non-empty string');
    });

    it('should throw error for whitespace-only command', () => {
      expect(() => new StdioAgentTransport('   ')).toThrow('Agent command cannot be empty');
    });

    it('should throw error for non-string command', () => {
      expect(() => new StdioAgentTransport(null as any)).toThrow(
        'Agent command must be a non-empty string'
      );
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

      // Simulate successful response
      setTimeout(() => {
        mockChild.stdout.emit('data', JSON.stringify(mockAgentResponse));
        mockChild.emit('close', 0);
      }, 10);

      const result = await promise;

      expect(mockChild.stdin.write).toHaveBeenCalledWith(JSON.stringify(mockAgentRequest));
      expect(mockChild.stdin.end).toHaveBeenCalled();
      expect(result).toEqual(mockAgentResponse);
    });

    it('should handle process exit with non-zero code', async () => {
      const promise = transport.dispatch(mockAgentRequest);

      setTimeout(() => {
        mockChild.stderr.emit('data', 'Process failed');
        mockChild.emit('close', 1);
      }, 10);

      await expect(promise).rejects.toThrow('Agent process failed: Process failed');
    });

    it('should handle invalid JSON response', async () => {
      const promise = transport.dispatch(mockAgentRequest);

      setTimeout(() => {
        mockChild.stdout.emit('data', 'invalid json');
        mockChild.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow('Invalid JSON response from agent');
    });

    it('should handle missing required fields in response', async () => {
      const invalidResponse = {
        timestamp: '2025-08-03T10:00:00Z',
        // missing type, content, metadata
      };

      const promise = transport.dispatch(mockAgentRequest);

      setTimeout(() => {
        mockChild.stdout.emit('data', JSON.stringify(invalidResponse));
        mockChild.emit('close', 0);
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

      await expect(promise).rejects.toThrow('Failed to spawn agent process: Command not found');
    });

    it('should handle timeout', async () => {
      mockGetAgentCallTimeout.mockReturnValue(100); // Short timeout
      const transport = new StdioAgentTransport(mockCommand);

      const promise = transport.dispatch(mockAgentRequest);

      // Don't emit any events to trigger timeout
      await expect(promise).rejects.toThrow('Agent call timeout after 100ms');
      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should handle process killed by signal', async () => {
      const promise = transport.dispatch(mockAgentRequest);

      setTimeout(() => {
        mockChild.emit('close', null, 'SIGTERM');
      }, 10);

      await expect(promise).rejects.toThrow('Agent process killed with signal SIGTERM');
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
