// Service to load, store, and serve the system prompt

import { readFileSync } from 'fs';
import { config } from 'dotenv';
config();

async function getPrompt() {
  const promptSource = process.env.CUBICLE_PROMPT_SOURCE;
  if (!promptSource) {
    throw new Error('CUBICLE_PROMPT_SOURCE is not defined in environment variables');
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
