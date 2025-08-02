import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  getAgentCallTimeout,
  getDefaultCallTimeout,
  getProviderCallTimeout,
} from './env-helper.js';

/**
 * HTTP request with timeout using provider timeout configuration
 * @param url - URL to request
 * @param options - Axios request configuration
 * @returns Promise that resolves to AxiosResponse
 * @throws Error if request fails or times out
 */
export async function fetchWithProviderTimeout(
  url: string,
  options: AxiosRequestConfig = {}
): Promise<AxiosResponse> {
  validateUrl(url);
  const timeoutMs = getProviderCallTimeout();
  return axiosWithTimeout(url, options, timeoutMs);
}

/**
 * HTTP request with timeout using agent timeout configuration
 * @param url - URL to request
 * @param options - Axios request configuration
 * @returns Promise that resolves to AxiosResponse
 * @throws Error if request fails or times out
 */
export async function fetchWithAgentTimeout(
  url: string,
  options: AxiosRequestConfig = {}
): Promise<AxiosResponse> {
  validateUrl(url);
  const timeoutMs = getAgentCallTimeout();
  return axiosWithTimeout(url, options, timeoutMs);
}

/**
 * HTTP request with timeout using default timeout configuration
 * @param url - URL to request
 * @param options - Axios request configuration
 * @returns Promise that resolves to AxiosResponse
 * @throws Error if request fails or times out
 */
export async function fetchWithDefaultTimeout(
  url: string,
  options: AxiosRequestConfig = {}
): Promise<AxiosResponse> {
  validateUrl(url);
  const timeoutMs = getDefaultCallTimeout();
  return axiosWithTimeout(url, options, timeoutMs);
}

/**
 * Validate URL parameter
 * @param url - URL to validate
 * @throws Error if URL is invalid
 */
function validateUrl(url: string): void {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  if (url.trim() === '') {
    throw new Error('URL cannot be empty or whitespace only');
  }
}

/**
 * HTTP request with custom timeout
 * @param url - URL to request
 * @param options - Axios request configuration
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that resolves to AxiosResponse
 * @throws Error if request fails or times out
 */
export async function axiosWithTimeout(
  url: string,
  options: AxiosRequestConfig = {},
  timeoutMs: number
): Promise<AxiosResponse> {
  validateUrl(url);
  validateTimeout(timeoutMs);

  const mergedOptions: AxiosRequestConfig = {
    ...options,
    timeout: timeoutMs,
    url,
  };

  try {
    return await axios(mergedOptions);
  } catch (error) {
    throw handleAxiosError(error, timeoutMs);
  }
}

/**
 * Validate timeout parameter
 * @param timeoutMs - Timeout to validate
 * @throws Error if timeout is invalid
 */
function validateTimeout(timeoutMs: number): void {
  if (typeof timeoutMs !== 'number' || timeoutMs <= 0 || !isFinite(timeoutMs)) {
    throw new Error('Timeout must be a positive finite number');
  }
}

/**
 * Handle axios errors and convert to meaningful error messages
 * @param error - Error from axios
 * @param timeoutMs - Timeout value for error message
 * @returns Error to throw
 */
function handleAxiosError(error: unknown, timeoutMs: number): Error {
  if (axios.isAxiosError && axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return new Error(`Request timeout after ${timeoutMs}ms`);
    }
    // Re-throw the axios error to be handled by the calling code
    return error;
  }

  return error instanceof Error ? error : new Error('Unknown request error');
}
