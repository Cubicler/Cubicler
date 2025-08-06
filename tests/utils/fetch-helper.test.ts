import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosResponse, AxiosError } from 'axios';
import {
  fetchWithProviderTimeout,
  fetchWithAgentTimeout,
  fetchWithDefaultTimeout,
  axiosWithTimeout,
} from '../../src/utils/fetch-helper.js';
import {
  getAgentCallTimeout,
  getDefaultCallTimeout,
  getProviderCallTimeout,
} from '../../src/utils/env-helper.js';

// Mock dependencies
vi.mock('axios');
vi.mock('../../src/utils/env-helper.js');

// Create a mock for axios.isAxiosError
const mockIsAxiosError = vi.fn();

const mockedAxios = vi.mocked(axios);
const mockedGetProviderCallTimeout = vi.mocked(getProviderCallTimeout);
const mockedGetAgentCallTimeout = vi.mocked(getAgentCallTimeout);
const mockedGetDefaultCallTimeout = vi.mocked(getDefaultCallTimeout);

describe('FetchHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock axios.isAxiosError
    (axios as any).isAxiosError = mockIsAxiosError;
  });

  describe('fetchWithProviderTimeout', () => {
    it('should make successful HTTP request with provider timeout', async () => {
      const mockResponse: AxiosResponse = {
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as AxiosResponse;

      mockedGetProviderCallTimeout.mockReturnValue(5000);
      mockedAxios.mockResolvedValue(mockResponse);

      const result = await fetchWithProviderTimeout('https://example.com', {
        method: 'GET',
      });

      expect(result).toBe(mockResponse);
      expect(mockedGetProviderCallTimeout).toHaveBeenCalledOnce();
      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'GET',
        timeout: 5000,
        url: 'https://example.com',
      });
    });

    it('should throw error for invalid URL', async () => {
      await expect(fetchWithProviderTimeout('')).rejects.toThrow('URL must be a non-empty string');
      await expect(fetchWithProviderTimeout('   ')).rejects.toThrow(
        'URL cannot be empty or whitespace only'
      );
      await expect(fetchWithProviderTimeout(null as any)).rejects.toThrow(
        'URL must be a non-empty string'
      );
      await expect(fetchWithProviderTimeout(undefined as any)).rejects.toThrow(
        'URL must be a non-empty string'
      );
      await expect(fetchWithProviderTimeout(123 as any)).rejects.toThrow(
        'URL must be a non-empty string'
      );
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'ECONNABORTED';

      mockedGetProviderCallTimeout.mockReturnValue(3000);
      mockIsAxiosError.mockReturnValue(true);
      mockedAxios.mockRejectedValue(timeoutError);

      await expect(fetchWithProviderTimeout('https://example.com')).rejects.toThrow(
        'Request timeout after 3000ms'
      );
    });
  });

  describe('fetchWithAgentTimeout', () => {
    it('should make successful HTTP request with agent timeout', async () => {
      const mockResponse: AxiosResponse = {
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as AxiosResponse;

      mockedGetAgentCallTimeout.mockReturnValue(10000);
      mockedAxios.mockResolvedValue(mockResponse);

      const result = await fetchWithAgentTimeout('https://api.example.com', {
        method: 'POST',
        data: { test: 'data' },
      });

      expect(result).toBe(mockResponse);
      expect(mockedGetAgentCallTimeout).toHaveBeenCalledOnce();
      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'POST',
        data: { test: 'data' },
        timeout: 10000,
        url: 'https://api.example.com',
      });
    });

    it('should throw error for invalid URL', async () => {
      await expect(fetchWithAgentTimeout('')).rejects.toThrow('URL must be a non-empty string');
    });
  });

  describe('fetchWithDefaultTimeout', () => {
    it('should make successful HTTP request with default timeout', async () => {
      const mockResponse: AxiosResponse = {
        data: { result: 'test' },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {},
      } as AxiosResponse;

      mockedGetDefaultCallTimeout.mockReturnValue(7500);
      mockedAxios.mockResolvedValue(mockResponse);

      const result = await fetchWithDefaultTimeout('https://localhost:3000', {
        headers: { 'Content-Type': 'application/json' },
      });

      expect(result).toBe(mockResponse);
      expect(mockedGetDefaultCallTimeout).toHaveBeenCalledOnce();
      expect(mockedAxios).toHaveBeenCalledWith({
        headers: { 'Content-Type': 'application/json' },
        timeout: 7500,
        url: 'https://localhost:3000',
      });
    });

    it('should throw error for invalid URL', async () => {
      await expect(fetchWithDefaultTimeout('')).rejects.toThrow('URL must be a non-empty string');
    });
  });

  describe('axiosWithTimeout', () => {
    it('should make successful HTTP request with custom timeout', async () => {
      const mockResponse: AxiosResponse = {
        data: { custom: 'response' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as AxiosResponse;

      mockedAxios.mockResolvedValue(mockResponse);

      const result = await axiosWithTimeout('https://custom.example.com', { method: 'PUT' }, 15000);

      expect(result).toBe(mockResponse);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'PUT',
        timeout: 15000,
        url: 'https://custom.example.com',
      });
    });

    it('should validate URL parameter', async () => {
      await expect(axiosWithTimeout('', {}, 5000)).rejects.toThrow(
        'URL must be a non-empty string'
      );
      await expect(axiosWithTimeout('   ', {}, 5000)).rejects.toThrow(
        'URL cannot be empty or whitespace only'
      );
      await expect(axiosWithTimeout(null as any, {}, 5000)).rejects.toThrow(
        'URL must be a non-empty string'
      );
      await expect(axiosWithTimeout(undefined as any, {}, 5000)).rejects.toThrow(
        'URL must be a non-empty string'
      );
      await expect(axiosWithTimeout(123 as any, {}, 5000)).rejects.toThrow(
        'URL must be a non-empty string'
      );
    });

    it('should validate timeout parameter', async () => {
      await expect(axiosWithTimeout('https://example.com', {}, 0)).rejects.toThrow(
        'Timeout must be a positive finite number'
      );

      await expect(axiosWithTimeout('https://example.com', {}, -1000)).rejects.toThrow(
        'Timeout must be a positive finite number'
      );

      await expect(axiosWithTimeout('https://example.com', {}, NaN)).rejects.toThrow(
        'Timeout must be a positive finite number'
      );

      await expect(axiosWithTimeout('https://example.com', {}, Infinity)).rejects.toThrow(
        'Timeout must be a positive finite number'
      );

      await expect(axiosWithTimeout('https://example.com', {}, 'invalid' as any)).rejects.toThrow(
        'Timeout must be a positive finite number'
      );
    });

    it('should handle timeout errors with ECONNABORTED code', async () => {
      const timeoutError = new Error('Network timeout') as AxiosError;
      timeoutError.code = 'ECONNABORTED';

      mockIsAxiosError.mockReturnValue(true);
      mockedAxios.mockRejectedValue(timeoutError);

      await expect(axiosWithTimeout('https://slow.example.com', {}, 2000)).rejects.toThrow(
        'Request timeout after 2000ms'
      );
    });

    it('should re-throw axios errors that are not timeouts', async () => {
      const networkError = new Error('Network Error') as AxiosError;
      networkError.code = 'ENOTFOUND';

      mockIsAxiosError.mockReturnValue(true);
      mockedAxios.mockRejectedValue(networkError);

      await expect(axiosWithTimeout('https://nonexistent.example.com', {}, 5000)).rejects.toBe(
        networkError
      );
    });

    it('should handle non-axios errors', async () => {
      const genericError = new Error('Generic error');
      mockIsAxiosError.mockReturnValue(false);
      mockedAxios.mockRejectedValue(genericError);

      await expect(axiosWithTimeout('https://example.com', {}, 5000)).rejects.toBe(genericError);
    });

    it('should handle unknown error types', async () => {
      const unknownError = 'string error';
      mockIsAxiosError.mockReturnValue(false);
      mockedAxios.mockRejectedValue(unknownError);

      await expect(axiosWithTimeout('https://example.com', {}, 5000)).rejects.toThrow(
        'Unknown request error'
      );
    });

    it('should merge options correctly', async () => {
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as AxiosResponse;

      mockedAxios.mockResolvedValue(mockResponse);

      await axiosWithTimeout(
        'https://example.com/api',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer token' },
          data: { key: 'value' },
        },
        8000
      );

      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        data: { key: 'value' },
        timeout: 8000,
        url: 'https://example.com/api',
      });
    });

    it('should handle empty options object', async () => {
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as AxiosResponse;

      mockedAxios.mockResolvedValue(mockResponse);

      await axiosWithTimeout('https://example.com', {}, 5000);

      expect(mockedAxios).toHaveBeenCalledWith({
        timeout: 5000,
        url: 'https://example.com',
      });
    });
  });
});
