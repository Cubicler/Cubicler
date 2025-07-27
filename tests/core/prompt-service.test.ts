import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import promptService from '../../src/core/prompt-service.js';
import mockFs from 'mock-fs';
import dotenv from 'dotenv';

// Mock axios
vi.mock('axios');
const mockAxios = axios as any;

// Create a manual mock for axios.isAxiosError
Object.defineProperty(axios, 'isAxiosError', {
  value: vi.fn().mockReturnValue(true),
  writable: true,
});

dotenv.config();

describe('promptService', () => {
  beforeEach(() => {
    mockFs({
      './tests/mocks/prompts.md': 'Default Test Prompt',
      './tests/mocks/prompts.gpt-4o.md': 'GPT-4o Specific Prompt',
    });
    vi.clearAllMocks();
    // Clear cache before each test
    promptService.clearCache();
  });

  afterEach(() => {
    mockFs.restore();
  });

  it('should fetch the default prompt from a remote source', async () => {
    process.env.CUBICLER_PROMPTS_SOURCE = 'https://example.com/prompt.md';

    mockAxios.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: 'Test Prompt',
    });

    const prompt = await promptService.getPrompt('gpt-4o');
    expect(prompt).toBe('Test Prompt');
    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/prompt.md',
        timeout: expect.any(Number),
      })
    );
  });

  it('should fetch the default prompt from a local file', async () => {
    process.env.CUBICLER_PROMPTS_SOURCE = './tests/mocks/prompts.md';

    const prompt = await promptService.getPrompt('gpt-4o');
    expect(prompt).toBe('Default Test Prompt');
  });

  it('should return agent-specific prompt when available', async () => {
    process.env.CUBICLER_PROMPTS_SOURCE = './tests/mocks';

    const prompt = await promptService.getPrompt('gpt-4o');
    expect(prompt).toBe('GPT-4o Specific Prompt');
  });

  it('should fallback to default prompt when agent-specific prompt not available', async () => {
    process.env.CUBICLER_PROMPTS_SOURCE = './tests/mocks';

    const prompt = await promptService.getPrompt('claude-3.5');
    expect(prompt).toBe('Default Test Prompt');
  });

  it('should throw an error if CUBICLER_PROMPTS_SOURCE is not defined', async () => {
    delete process.env.CUBICLER_PROMPTS_SOURCE;

    await expect(promptService.getPrompt('gpt-4o')).rejects.toThrow(
      'CUBICLER_PROMPTS_SOURCE is not defined in environment variables'
    );
  });

  it('should throw an error if no default prompt is found', async () => {
    process.env.CUBICLER_PROMPTS_SOURCE = './tests/mocks/nonexistent';

    await expect(promptService.getPrompt('gpt-4o')).rejects.toThrow(
      'Cannot fetch prompts from path'
    );
  });

  it('should throw an error with detailed message when remote fetch fails', async () => {
    process.env.CUBICLER_PROMPTS_SOURCE = 'https://example.com/nonexistent';

    const error = {
      isAxiosError: true,
      response: {
        status: 404,
        statusText: 'Not Found',
      },
    };
    mockAxios.mockRejectedValue(error);

    await expect(promptService.getPrompt('gpt-4o')).rejects.toThrow(
      'Cannot fetch prompts from URL'
    );
  });

  it('should throw an error when both default and agent-specific prompts are empty', async () => {
    process.env.CUBICLER_PROMPTS_SOURCE = 'https://example.com/empty-prompt';

    mockAxios.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: '',
    });

    await expect(promptService.getPrompt('gpt-4o')).rejects.toThrow(
      "No prompts available. Default prompt is empty and no agent-specific prompt found for 'gpt-4o'."
    );
  });

  it('should fetch agent-specific prompts from URL when available', async () => {
    process.env.CUBICLER_PROMPTS_SOURCE = 'https://example.com/prompts';
    // Set required environment variables for agent service
    process.env.CUBICLER_AGENTS_LIST = 'https://example.com/agents.yaml';

    // Mock the agent service call directly
    const { default: agentService } = await import('../../src/core/agent-service.js');
    const originalGetAvailableAgents = vi.spyOn(agentService, 'getAvailableAgents');
    originalGetAvailableAgents.mockResolvedValue(['gpt-4o', 'claude-3.5', 'gemini-1.5']);

    // Mock axios to return different responses for different URLs
    (mockAxios as any).mockImplementation((config: any) => {
      const url = config.url || '';
      if (url === 'https://example.com/prompts') {
        // Single file fetch fails
        return Promise.reject({
          isAxiosError: true,
          response: { status: 404, statusText: 'Not Found' },
        });
      } else if (url === 'https://example.com/prompts/prompts.md') {
        // Default prompt
        return Promise.resolve({ status: 200, statusText: 'OK', data: 'Default Prompt' });
      } else if (url === 'https://example.com/prompts/prompts.gpt-4o.md') {
        // Agent-specific prompt
        return Promise.resolve({ status: 200, statusText: 'OK', data: 'GPT-4o Specific Prompt' });
      } else {
        // All other URLs (other agent prompts) return 404
        return Promise.reject({
          isAxiosError: true,
          response: { status: 404, statusText: 'Not Found' },
        });
      }
    });

    const prompt = await promptService.getPrompt('gpt-4o');

    expect(prompt).toBe('GPT-4o Specific Prompt'); // Should get agent-specific prompt

    // Clean up
    originalGetAvailableAgents.mockRestore();
  });
});
