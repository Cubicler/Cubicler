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
  const timeoutMs = getDefaultCallTimeout();
  return axiosWithTimeout(url, options, timeoutMs);
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
  const mergedOptions: AxiosRequestConfig = {
    ...options,
    timeout: timeoutMs,
    url,
  };

  try {
    const response = await axios(mergedOptions);
    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      // Re-throw the axios error to be handled by the calling code
      throw error;
    }
    throw error;
  }
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use axiosWithTimeout instead
 */
export const fetchWithTimeout = axiosWithTimeout;
