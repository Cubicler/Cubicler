import { jest } from '@jest/globals';
import promptService from '../../src/core/prompt-service.js';
import mockFs from 'mock-fs';
import dotenv from 'dotenv';

dotenv.config();

describe('promptService', () => {
  beforeEach(() => {
    mockFs({
      './tests/mocks/prompts.md': 'Default Test Prompt',
      './tests/mocks/prompts.gpt-4o.md': 'GPT-4o Specific Prompt',
    });
    jest.clearAllMocks();
    // Clear cache before each test
    promptService.clearCache();
  });

  afterEach(() => {
    mockFs.restore();
  });

  it('should fetch the default prompt from a remote source', async () => {
    process.env.CUBICLER_PROMPTS_SOURCE = 'https://example.com/prompt.md';
    
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve('Test Prompt')
    } as Response));

    const prompt = await promptService.getPrompt('gpt-4o');
    expect(prompt).toBe('Test Prompt');
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/prompt.md');
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

    await expect(promptService.getPrompt('gpt-4o')).rejects.toThrow('CUBICLER_PROMPTS_SOURCE is not defined in environment variables');
  });

  it('should throw an error if no default prompt is found', async () => {
    process.env.CUBICLER_PROMPTS_SOURCE = './tests/mocks/nonexistent';
    
    await expect(promptService.getPrompt('gpt-4o')).rejects.toThrow('Cannot fetch prompts from path');
  });

  it('should throw an error with detailed message when remote fetch fails', async () => {
    process.env.CUBICLER_PROMPTS_SOURCE = 'https://example.com/nonexistent';
    
    global.fetch = jest.fn(() => Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    } as Response));

    await expect(promptService.getPrompt('gpt-4o')).rejects.toThrow('Cannot fetch prompts from URL');
  });

  it('should throw an error when both default and agent-specific prompts are empty', async () => {
    process.env.CUBICLER_PROMPTS_SOURCE = 'https://example.com/empty-prompt';
    
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve('')
    } as Response));

    await expect(promptService.getPrompt('gpt-4o')).rejects.toThrow('No prompts available. Default prompt is empty and no agent-specific prompt found for \'gpt-4o\'.');
  });

  it('should fetch agent-specific prompts from URL when available', async () => {
    process.env.CUBICLER_PROMPTS_SOURCE = 'https://example.com/prompts';
    // Set required environment variables for agent service
    process.env.CUBICLER_AGENTS_LIST = 'https://example.com/agents.yaml';
    
    // Mock the agent service call directly
    const originalGetAvailableAgents = jest.spyOn(require('../../src/core/agent-service.js').default, 'getAvailableAgents');
    originalGetAvailableAgents.mockResolvedValue(['gpt-4o', 'claude-3.5', 'gemini-1.5']);
    
    // Mock fetch to return different responses for different URLs
    const mockFetch = jest.fn().mockImplementation((url) => {
      if (url === 'https://example.com/prompts') {
        // Single file fetch fails
        return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' } as Response);
      } else if (url === 'https://example.com/prompts/prompts.md') {
        // Default prompt
        return Promise.resolve({ ok: true, text: () => Promise.resolve('Default Prompt') } as Response);
      } else if (url === 'https://example.com/prompts/prompts.gpt-4o.md') {
        // Agent-specific prompt
        return Promise.resolve({ ok: true, text: () => Promise.resolve('GPT-4o Specific Prompt') } as Response);
      } else {
        // All other URLs (other agent prompts) return 404
        return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' } as Response);
      }
    });
    
    global.fetch = mockFetch as any;

    // Test GPT-4o gets its specific prompt
    const gptPrompt = await promptService.getPrompt('gpt-4o');
    expect(gptPrompt).toBe('GPT-4o Specific Prompt');
    
    // Clear cache to test fallback
    promptService.clearCache();
    
    // Test Claude falls back to default
    const claudePrompt = await promptService.getPrompt('claude-3.5');
    expect(claudePrompt).toBe('Default Prompt');
    
    // Verify key fetch calls were made
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/prompts');
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/prompts/prompts.md');
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/prompts/prompts.gpt-4o.md');
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/prompts/prompts.claude-3.5.md');
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/prompts/prompts.gemini-1.5.md');
    
    // Restore the original implementation
    originalGetAvailableAgents.mockRestore();
  });
});
