import { resolve } from 'path';
import dotenv from 'dotenv';

// Ensure integration .env is loaded if present so keys can be detected
dotenv.config({ path: resolve(__dirname, '.env') });

export function hasRequiredIntegrationEnv(): boolean {
  const missing: string[] = [];
  if (!process.env.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
  if (!process.env.OPENWEATHER_API_KEY) missing.push('OPENWEATHER_API_KEY');

  if (missing.length) {
    // Provide a concise hint in CI logs

    console.warn(`Skipping integration tests: missing ${missing.join(', ')}`);
    return false;
  }
  return true;
}
