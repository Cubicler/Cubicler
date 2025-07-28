import { describe, it, expect } from 'vitest';
import {
  parseFunctionName,
  extractPathParameters,
  replacePathParameters,
  convertToQueryParams,
  buildUrl,
} from '../../src/utils/parameter-helper.js';

describe('Parameter Helper', () => {
  describe('parseFunctionName', () => {
    it('should parse valid function name', () => {
      const result = parseFunctionName('weather_service.get_current_weather');

      expect(result.serverIdentifier).toBe('weather_service');
      expect(result.functionName).toBe('get_current_weather');
    });

    it('should throw error for invalid format', () => {
      expect(() => parseFunctionName('invalid_function_name')).toThrow(
        'Invalid function name format'
      );
      expect(() => parseFunctionName('too.many.parts.here')).toThrow(
        'Invalid function name format'
      );
    });
  });

  describe('extractPathParameters', () => {
    it('should extract path parameters and leave remaining parameters', () => {
      const path = '/users/{userId}/posts/{postId}';
      const parameters = {
        userId: '123',
        postId: '456',
        includeComments: true,
        limit: 10,
      };

      const result = extractPathParameters(path, parameters);

      expect(result.pathParams).toEqual({
        userId: '123',
        postId: '456',
      });
      expect(result.remainingParams).toEqual({
        includeComments: true,
        limit: 10,
      });
    });

    it('should handle path with no parameters', () => {
      const path = '/users';
      const parameters = { limit: 5 };

      const result = extractPathParameters(path, parameters);

      expect(result.pathParams).toEqual({});
      expect(result.remainingParams).toEqual({ limit: 5 });
    });

    it('should handle missing path parameters', () => {
      const path = '/users/{userId}';
      const parameters = { limit: 5 };

      const result = extractPathParameters(path, parameters);

      expect(result.pathParams).toEqual({});
      expect(result.remainingParams).toEqual({ limit: 5 });
    });
  });

  describe('replacePathParameters', () => {
    it('should replace path parameters', () => {
      const pathTemplate = '/users/{userId}/posts/{postId}';
      const pathParams = { userId: '123', postId: '456' };

      const result = replacePathParameters(pathTemplate, pathParams);

      expect(result).toBe('/users/123/posts/456');
    });

    it('should handle path with no parameters', () => {
      const pathTemplate = '/users';
      const pathParams = {};

      const result = replacePathParameters(pathTemplate, pathParams);

      expect(result).toBe('/users');
    });

    it('should leave unreplaced parameters as-is', () => {
      const pathTemplate = '/users/{userId}/posts/{postId}';
      const pathParams = { userId: '123' }; // Missing postId

      const result = replacePathParameters(pathTemplate, pathParams);

      expect(result).toBe('/users/123/posts/{postId}');
    });
  });

  describe('convertToQueryParams', () => {
    it('should convert simple parameters to query strings', () => {
      const parameters = {
        includeComments: true,
        limit: 10,
        name: 'test',
      };

      const result = convertToQueryParams(parameters);

      expect(result).toEqual({
        includeComments: 'true',
        limit: '10',
        name: 'test',
      });
    });

    it('should convert arrays to comma-separated strings', () => {
      const parameters = {
        tags: ['javascript', 'typescript'],
        ids: [1, 2, 3],
      };

      const result = convertToQueryParams(parameters);

      expect(result).toEqual({
        tags: 'javascript,typescript',
        ids: '1,2,3',
      });
    });

    it('should JSON stringify complex objects', () => {
      const parameters = {
        filter: { status: 'active' },
        users: [{ name: 'John' }],
      };

      const result = convertToQueryParams(parameters);

      expect(result).toEqual({
        filter: JSON.stringify({ status: 'active' }),
        users: JSON.stringify([{ name: 'John' }]),
      });
    });
  });

  describe('buildUrl', () => {
    it('should build complete URL with path and query parameters', () => {
      const baseUrl = 'http://localhost:5000/api';
      const pathTemplate = '/users/{userId}';
      const pathParams = { userId: '123' };
      const queryParams = { include: 'profile', limit: '10' };

      const result = buildUrl(baseUrl, pathTemplate, pathParams, queryParams);

      expect(result).toBe('http://localhost:5000/api/users/123?include=profile&limit=10');
    });

    it('should handle URL without query parameters', () => {
      const baseUrl = 'http://localhost:5000/api';
      const pathTemplate = '/users/{userId}';
      const pathParams = { userId: '123' };
      const queryParams = {};

      const result = buildUrl(baseUrl, pathTemplate, pathParams, queryParams);

      expect(result).toBe('http://localhost:5000/api/users/123');
    });

    it('should handle URL without path parameters', () => {
      const baseUrl = 'http://localhost:5000/api';
      const pathTemplate = '/users';
      const pathParams = {};
      const queryParams = { limit: '10' };

      const result = buildUrl(baseUrl, pathTemplate, pathParams, queryParams);

      expect(result).toBe('http://localhost:5000/api/users?limit=10');
    });
  });
});
