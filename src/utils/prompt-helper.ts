import { readFileSync } from 'fs';
import { fetchWithDefaultTimeout } from './fetch-helper.js';
import { getConfigLoadTimeout } from './env-helper.js';
import { isFilePath, isInline, isRemoteUrl } from './source-helper.js';

/**
 * Prompt loading helper utilities
 * Provides utilities for loading prompts from files or URLs
 */

/**
 * Load text content from source (file or URL)
 * @param source - The source path/URL to load from
 * @param description - Description for error messages (e.g., "base prompt", "agent prompt")
 * @returns Promise that resolves to the text content
 */
export async function loadPromptFromSource(source: string, description: string): Promise<string> {
  console.log(`📋 [PromptHelper] Loading ${description} from: ${source}`);

  let content: string;

  if (isRemoteUrl(source)) {
    // Load from URL
    try {
      console.log(`🌐 [PromptHelper] Fetching ${description} from remote URL...`);
      const response = await fetchWithDefaultTimeout(source, {
        timeout: getConfigLoadTimeout(),
        headers: {
          Accept: 'text/plain, text/markdown, application/octet-stream',
          'User-Agent': 'Cubicler/2.0',
        },
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Handle different response types
      if (typeof response.data === 'string') {
        content = response.data;
      } else if (response.data && typeof response.data === 'object') {
        // If we got JSON, stringify it (shouldn't happen for prompts, but just in case)
        content = JSON.stringify(response.data, null, 2);
      } else {
        throw new Error('Remote URL returned invalid content');
      }

      console.log(
        `✅ [PromptHelper] Successfully loaded ${description} from remote URL (${content.length} characters)`
      );
    } catch (error) {
      console.error(`❌ [PromptHelper] Failed to fetch ${description} from URL:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load ${description} from URL "${source}": ${errorMessage}`);
    }
  } else if (isFilePath(source)) {
    // Load from file
    try {
      console.log(`📁 [PromptHelper] Loading ${description} from local file...`);
      content = readFileSync(source, 'utf-8');
      console.log(
        `✅ [PromptHelper] Successfully loaded ${description} from local file (${content.length} characters)`
      );
    } catch (error) {
      console.error(`❌ [PromptHelper] Failed to load ${description} from file:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load ${description} from file "${source}": ${errorMessage}`);
    }
  } else {
    throw new Error(
      `Invalid source format for ${description}: "${source}". Must be a valid URL or file path.`
    );
  }

  return content.trim();
}

/**
 * Check if a string looks like a URL or file path (for prompt loading)
 * @param value - The value to check
 * @returns true if the value looks like a path/URL rather than inline content
 */
export function isPromptSource(value: string): boolean {
  return isRemoteUrl(value) || isFilePath(value);
}

/**
 * Load prompt content, automatically detecting if it's a source path/URL or inline content
 * @param promptValue - The prompt value (either inline content or source path/URL)
 * @param description - Description for error messages
 * @returns Promise that resolves to the prompt content
 */
export async function loadPrompt(promptValue: string, description: string): Promise<string> {
  // Handle empty or null values
  if (!promptValue || typeof promptValue !== 'string') {
    return '';
  }

  // If it's inline content, return it directly
  if (isInline(promptValue)) {
    console.log(`📝 [PromptHelper] Using inline ${description} (${promptValue.length} characters)`);
    return promptValue.trim();
  }

  // If it looks like a source path/URL, try to load from source
  if (isPromptSource(promptValue)) {
    try {
      return await loadPromptFromSource(promptValue, description);
    } catch (error) {
      // If loading from source fails, fall back to treating as inline content
      console.warn(
        `⚠️ [PromptHelper] Failed to load ${description} from source, treating as inline content:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
      return promptValue.trim();
    }
  }

  // Fallback: treat as inline content
  console.log(`📝 [PromptHelper] Using inline ${description} (${promptValue.length} characters)`);
  return promptValue.trim();
}
