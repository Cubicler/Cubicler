import { jest } from '@jest/globals';
import promptService from '../../src/core/promptService';
import mockFs from 'mock-fs';
import dotenv from 'dotenv';

dotenv.config();

describe('promptService', () => {
  beforeEach(() => {
    mockFs({
      './tests/mockPrompt.md': 'Local Test Prompt',
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockFs.restore();
  });

  it('should fetch the prompt from a remote source', async () => {
    process.env.CUBICLE_PROMPT_SOURCE = 'https://example.com/prompt.md';
    
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve('Test Prompt')
    }));

    const prompt = await promptService.getPrompt();
    expect(prompt).toBe('Test Prompt');
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/prompt.md');
  });

  it('should fetch the prompt from a local file', async () => {
    process.env.CUBICLE_PROMPT_SOURCE = './tests/mockPrompt.md';

    const prompt = await promptService.getPrompt();
    expect(prompt).toBe('Local Test Prompt');
  });

  it('should throw an error if CUBICLE_PROMPT_SOURCE is not defined', async () => {
    delete process.env.CUBICLE_PROMPT_SOURCE;

    await expect(promptService.getPrompt()).rejects.toThrow('CUBICLE_PROMPT_SOURCE is not defined in environment variables');
  });
});
