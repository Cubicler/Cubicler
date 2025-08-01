import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPrompt, loadPromptFromSource, isPromptSource } from '../../src/utils/prompt-helper.js';
import { readFileSync } from 'fs';
import { fetchWithDefaultTimeout } from '../../src/utils/fetch-helper.js';

// Mock the dependencies
vi.mock('fs');
vi.mock('../../src/utils/fetch-helper.js');
vi.mock('../../src/utils/env-helper.js', () => ({
  getConfigLoadTimeout: () => 5000,
}));

const mockReadFileSync = vi.mocked(readFileSync);
const mockFetchWithDefaultTimeout = vi.mocked(fetchWithDefaultTimeout);

describe('PromptHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isPromptSource', () => {
    it('should detect URLs as sources', () => {
      expect(isPromptSource('https://example.com/prompt.md')).toBe(true);
      expect(isPromptSource('http://localhost:3000/prompt.txt')).toBe(true);
    });

    it('should detect file paths as sources', () => {
      expect(isPromptSource('./prompts/agent.md')).toBe(true);
      expect(isPromptSource('../prompts/base.txt')).toBe(true);
      expect(isPromptSource('~/prompts/default.md')).toBe(true);
      expect(isPromptSource('/absolute/path/prompt.txt')).toBe(true);
      expect(isPromptSource('relative/path/prompt.md')).toBe(true);
    });

    it('should detect file extensions as sources', () => {
      expect(isPromptSource('prompt.md')).toBe(true);
      expect(isPromptSource('prompt.txt')).toBe(true);
      expect(isPromptSource('prompt.markdown')).toBe(true);
      expect(isPromptSource('prompt.text')).toBe(true);
    });

    it('should not detect inline content as sources', () => {
      expect(isPromptSource('You are a helpful assistant')).toBe(false);
      expect(isPromptSource('This is a long prompt with multiple sentences.')).toBe(false);
      expect(isPromptSource('Multi-line\nprompt content')).toBe(false);
    });
  });

  describe('loadPromptFromSource', () => {
    it('should load from remote URL', async () => {
      const mockContent = 'You are a helpful AI assistant from URL';
      mockFetchWithDefaultTimeout.mockResolvedValue({
        status: 200,
        data: mockContent,
        headers: {},
        statusText: 'OK',
        config: {},
      } as any);

      const result = await loadPromptFromSource(
        'https://example.com/prompt.md',
        'test prompt'
      );

      expect(result).toBe(mockContent);
      expect(mockFetchWithDefaultTimeout).toHaveBeenCalledWith(
        'https://example.com/prompt.md',
        expect.objectContaining({
          timeout: 5000,
          headers: expect.objectContaining({
            Accept: 'text/plain, text/markdown, application/octet-stream',
            'User-Agent': 'Cubicler/2.0'
          })
        })
      );
    });

    it('should load from local file', async () => {
      const mockContent = 'You are a helpful AI assistant from file';
      mockReadFileSync.mockReturnValue(mockContent);

      const result = await loadPromptFromSource('./prompt.md', 'test prompt');

      expect(result).toBe(mockContent);
      expect(mockReadFileSync).toHaveBeenCalledWith('./prompt.md', 'utf-8');
    });

    it('should handle URL fetch errors', async () => {
      mockFetchWithDefaultTimeout.mockRejectedValue(new Error('Network error'));

      await expect(
        loadPromptFromSource('https://example.com/prompt.md', 'test prompt')
      ).rejects.toThrow('Failed to load test prompt from URL');
    });

    it('should handle file read errors', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(
        loadPromptFromSource('./nonexistent.md', 'test prompt')
      ).rejects.toThrow('Failed to load test prompt from file');
    });

    it('should handle HTTP error responses', async () => {
      mockFetchWithDefaultTimeout.mockResolvedValue({
        status: 404,
        statusText: 'Not Found',
        data: null,
        headers: {},
        config: {},
      } as any);

      await expect(
        loadPromptFromSource('https://example.com/prompt.md', 'test prompt')
      ).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should trim whitespace from content', async () => {
      const mockContent = '   You are a helpful AI assistant   \n\n';
      mockReadFileSync.mockReturnValue(mockContent);

      const result = await loadPromptFromSource('./prompt.md', 'test prompt');

      expect(result).toBe('You are a helpful AI assistant');
    });
  });

  describe('loadPrompt', () => {
    it('should load from source when value looks like a path', async () => {
      const mockContent = 'You are a helpful AI assistant';
      mockReadFileSync.mockReturnValue(mockContent);

      const result = await loadPrompt('./prompt.md', 'test prompt');

      expect(result).toBe(mockContent);
      expect(mockReadFileSync).toHaveBeenCalledWith('./prompt.md', 'utf-8');
    });

    it('should return inline content when value does not look like a path', async () => {
      const inlineContent = 'You are a helpful AI assistant with special instructions.';

      const result = await loadPrompt(inlineContent, 'test prompt');

      expect(result).toBe(inlineContent);
      expect(mockReadFileSync).not.toHaveBeenCalled();
      expect(mockFetchWithDefaultTimeout).not.toHaveBeenCalled();
    });

    it('should handle empty or null values', async () => {
      expect(await loadPrompt('', 'test prompt')).toBe('');
      expect(await loadPrompt('   ', 'test prompt')).toBe('');
      
      expect(mockReadFileSync).not.toHaveBeenCalled();
      expect(mockFetchWithDefaultTimeout).not.toHaveBeenCalled();
    });

    it('should detect and use inline content correctly', async () => {
      const testCases = [
        'You are a helpful assistant',
        'This is a multi-line\nprompt content',
        'Prompt with numbers 123 and symbols !@#',
        'Question prompt?',
        'Exclamation prompt!',
        'Long sentence with punctuation.',
        'Multiple words separated by spaces'
      ];

      for (const testCase of testCases) {
        const result = await loadPrompt(testCase, 'test prompt');
        expect(result).toBe(testCase);
        expect(mockReadFileSync).not.toHaveBeenCalled();
        expect(mockFetchWithDefaultTimeout).not.toHaveBeenCalled();
        
        vi.clearAllMocks();
      }
    });

    it('should trim inline content', async () => {
      const inlineContent = '   You are a helpful AI assistant   \n\n';

      const result = await loadPrompt(inlineContent, 'test prompt');

      expect(result).toBe('You are a helpful AI assistant');
    });

    it('should fallback to inline content when URL loading fails', async () => {
      const urlContent = 'https://example.com/nonexistent.md';
      mockFetchWithDefaultTimeout.mockRejectedValue(new Error('Not found'));

      const result = await loadPrompt(urlContent, 'test prompt');

      expect(result).toBe(urlContent);
      expect(mockFetchWithDefaultTimeout).toHaveBeenCalled();
    });

    it('should fallback to inline content when file loading fails', async () => {
      const fileContent = './nonexistent.md';
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = await loadPrompt(fileContent, 'test prompt');

      expect(result).toBe(fileContent);
      expect(mockReadFileSync).toHaveBeenCalledWith('./nonexistent.md', 'utf-8');
    });

    it('should fallback to inline content for path-like strings that are actually prompts', async () => {
      // This should be detected as a path due to the file extension
      const promptWithPath = './some-config.md but actually this is a long prompt with instructions';
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = await loadPrompt(promptWithPath, 'test prompt');

      expect(result).toBe(promptWithPath);
      expect(mockReadFileSync).toHaveBeenCalledWith('./some-config.md but actually this is a long prompt with instructions', 'utf-8');
    });
  });
});
