import { getProviderCallTimeout, getAgentCallTimeout, getDefaultCallTimeout } from './env-helper.js';

/**
 * Fetch with timeout using provider timeout configuration
 * @param url - URL to fetch
 * @param options - Standard fetch options (RequestInit)
 * @returns Promise that resolves to Response
 * @throws Error if request fails or times out
 */
export async function fetchWithProviderTimeout(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const timeoutMs = getProviderCallTimeout();
  return fetchWithTimeout(url, options, timeoutMs);
}

/**
 * Fetch with timeout using agent timeout configuration
 * @param url - URL to fetch
 * @param options - Standard fetch options (RequestInit)
 * @returns Promise that resolves to Response
 * @throws Error if request fails or times out
 */
export async function fetchWithAgentTimeout(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const timeoutMs = getAgentCallTimeout();
  return fetchWithTimeout(url, options, timeoutMs);
}

/**
 * Fetch with timeout using default timeout configuration
 * @param url - URL to fetch
 * @param options - Standard fetch options (RequestInit)
 * @returns Promise that resolves to Response
 * @throws Error if request fails or times out
 */
export async function fetchWithDefaultTimeout(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const timeoutMs = getDefaultCallTimeout();
  return fetchWithTimeout(url, options, timeoutMs);
}

/**
 * Fetch with custom timeout
 * @param url - URL to fetch
 * @param options - Standard fetch options (RequestInit)
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that resolves to Response
 * @throws Error if request fails or times out
 */
export async function fetchWithTimeout(
  url: string, 
  options: RequestInit = {}, 
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const mergedOptions: RequestInit = {
    ...options,
    signal: controller.signal,
  };

  try {
    const response = await fetch(url, mergedOptions);
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}
