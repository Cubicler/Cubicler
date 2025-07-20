import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

/**
 * Gets the system prompt from the configured source
 * @returns Promise that resolves to the prompt text
 * @throws Error if CUBICLER_PROMPT_SOURCE is not defined or fetch fails
 */
async function getPrompt(): Promise<string> {
  const promptSource = process.env.CUBICLER_PROMPT_SOURCE;
  if (!promptSource) {
    throw new Error('CUBICLER_PROMPT_SOURCE is not defined in environment variables');
  }

  if (promptSource.startsWith('http')) {
    const response = await fetch(promptSource);
    if (!response.ok) {
      throw new Error(`Failed to fetch prompt: ${response.statusText}`);
    }
    return await response.text();
  } else {
    return readFileSync(promptSource, 'utf-8');
  }
}

export default { getPrompt };
