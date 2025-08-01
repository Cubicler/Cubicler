import { describe, it, expect } from 'vitest';
import { loadPrompt } from '../../src/utils/prompt-helper.js';

describe('Inline Prompt Bug Fix', () => {
  it('should handle inline text prompts correctly', async () => {
    // Test various inline prompts that should NOT be treated as file paths
    const inlinePrompts = [
      'You are a helpful assistant',
      'Act as a code reviewer and analyze the following code',
      'Translate the following text to French: Hello world',
      'Summarize this article in 3 bullet points',
      'Debug this error message and suggest a fix',
      'Write a creative story about a robot',
      'Explain quantum computing in simple terms',
    ];

    for (const prompt of inlinePrompts) {
      const result = await loadPrompt(prompt, 'test inline prompt');
      expect(result).toBe(prompt);
    }
  });

  it('should still detect and load file paths', async () => {
    // These should be detected as file paths (but will fail to load and fallback to inline)
    const filePaths = [
      './prompt.md',
      '../agents/agent-prompt.txt',
      '/path/to/system-prompt.md',
      '~/prompts/base.txt',
      'config.json',
    ];

    for (const path of filePaths) {
      const result = await loadPrompt(path, 'test file prompt');
      // Since files don't exist, it should fallback to treating as inline content
      expect(result).toBe(path);
    }
  });

  it('should still detect and load URLs', async () => {
    // These should be detected as URLs (but will fail to load and fallback to inline)
    const urls = ['https://example.com/prompt.md', 'http://localhost:3000/api/prompt'];

    for (const url of urls) {
      const result = await loadPrompt(url, 'test URL prompt');
      // Since URLs will fail, it should fallback to treating as inline content
      expect(result).toBe(url);
    }
  });

  it('should handle edge cases correctly', async () => {
    // Empty content
    expect(await loadPrompt('', 'empty')).toBe('');

    // Whitespace-only content
    expect(await loadPrompt('   ', 'whitespace')).toBe('');

    // Content with spaces (clearly inline)
    expect(await loadPrompt('hello world', 'inline with spaces')).toBe('hello world');

    // Content with punctuation (clearly inline)
    expect(await loadPrompt('What is AI?', 'inline with question')).toBe('What is AI?');
  });
});
