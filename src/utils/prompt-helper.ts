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
 * @throws Error if inputs are invalid or loading fails
 */
export async function loadPromptFromSource(source: string, description: string): Promise<string> {
  validatePromptSourceInputs(source, description);

  console.log(`📋 [PromptHelper] Loading ${description} from: ${source}`);

  const content = isRemoteUrl(source)
    ? await loadPromptFromUrl(source, description)
    : loadPromptFromFile(source, description);

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
 * @throws Error if inputs are invalid
 */
export async function loadPrompt(promptValue: string, description: string): Promise<string> {
  // Validate inputs
  if (!description || typeof description !== 'string') {
    throw new Error('Description must be a non-empty string');
  }

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
    return await loadFromSourceWithFallback(promptValue, description);
  }

  // Fallback: treat as inline content
  console.log(`📝 [PromptHelper] Using inline ${description} (${promptValue.length} characters)`);
  return promptValue.trim();
}

/**
 * Validate inputs for prompt loading
 * @param source - Source to validate
 * @param description - Description to validate
 * @throws Error if inputs are invalid
 */
function validatePromptSourceInputs(source: string, description: string): void {
  if (!source || typeof source !== 'string') {
    throw new Error('Source must be a non-empty string');
  }

  if (!description || typeof description !== 'string') {
    throw new Error('Description must be a non-empty string');
  }
}

/**
 * Load prompt content from remote URL
 * @param url - URL to load from
 * @param description - Description for error messages
 * @returns Promise that resolves to the content
 * @throws Error if loading fails
 */
async function loadPromptFromUrl(url: string, description: string): Promise<string> {
  console.log(`🌐 [PromptHelper] Fetching ${description} from remote URL...`);

  try {
    const response = await fetchWithDefaultTimeout(url, {
      timeout: getConfigLoadTimeout(),
      headers: {
        Accept: 'text/plain, text/markdown, application/octet-stream',
        'User-Agent': 'Cubicler/2.0',
      },
    });

    validatePromptResponse(response);
    const content = extractContentFromResponse(response);

    console.log(
      `✅ [PromptHelper] Successfully loaded ${description} from remote URL (${content.length} characters)`
    );

    return content;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load ${description} from URL "${url}": ${errorMessage}`);
  }
}

/**
 * Load prompt content from local file
 * @param filePath - File path to load from
 * @param description - Description for error messages
 * @returns The file content
 * @throws Error if loading fails
 */
function loadPromptFromFile(filePath: string, description: string): string {
  console.log(`📁 [PromptHelper] Loading ${description} from local file...`);

  try {
    const content = readFileSync(filePath, 'utf-8');

    console.log(
      `✅ [PromptHelper] Successfully loaded ${description} from local file (${content.length} characters)`
    );

    return content;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load ${description} from file "${filePath}": ${errorMessage}`);
  }
}

/**
 * Validate HTTP response for prompt loading
 * @param response - Response to validate
 * @throws Error if response is invalid
 */
function validatePromptResponse(response: { status: number; statusText: string }): void {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}

/**
 * Extract content from HTTP response
 * @param response - Response to extract content from
 * @returns Extracted content
 * @throws Error if content is invalid
 */
function extractContentFromResponse(response: { data: unknown }): string {
  if (typeof response.data === 'string') {
    return response.data;
  }

  if (response.data && typeof response.data === 'object') {
    // If we got JSON, stringify it (shouldn't happen for prompts, but just in case)
    return JSON.stringify(response.data, null, 2);
  }

  throw new Error('Remote URL returned invalid content');
}

/**
 * Load from source with fallback to inline content
 * @param promptValue - The prompt value to load
 * @param description - Description for error messages
 * @returns Promise that resolves to the content
 */
async function loadFromSourceWithFallback(
  promptValue: string,
  description: string
): Promise<string> {
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
