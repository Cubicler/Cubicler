import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { Cache, createEnvCache } from '../../src/utils/cache.js';

describe('Cache Utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Cache', () => {
    it('should store and retrieve values', () => {
      const cache = new Cache<string>(300); // 5 minutes TTL

      cache.set('key1', 'value1');
      
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      const cache = new Cache<string>(300);

      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should expire values after TTL', async () => {
      const cache = new Cache<string>(0.1); // 0.1 seconds TTL

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150)); // 150ms > 100ms TTL

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should clear all cached values', () => {
      const cache = new Cache<string>(300);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should handle complex objects', () => {
      const cache = new Cache<{name: string, value: number}>(300);
      
      const testObject = { name: 'test', value: 42 };
      cache.set('object', testObject);
      
      const retrieved = cache.get('object');
      expect(retrieved).toEqual(testObject);
      expect(retrieved?.name).toBe('test');
      expect(retrieved?.value).toBe(42);
    });

    it('should overwrite existing keys', () => {
      const cache = new Cache<string>(300);

      cache.set('key1', 'original');
      expect(cache.get('key1')).toBe('original');

      cache.set('key1', 'updated');
      expect(cache.get('key1')).toBe('updated');
    });
  });

  describe('createEnvCache', () => {
    it('should create cache with default TTL when env var not set', () => {
      delete process.env.TEST_CACHE_TTL;
      delete process.env.TEST_CACHE_ENABLED;

      const cache = createEnvCache<string>('TEST', 600);
      
      // Should work normally with default TTL
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should use custom TTL from environment variable', () => {
      process.env.TEST_CACHE_TTL = '1200'; // 20 minutes
      process.env.TEST_CACHE_ENABLED = 'true';

      const cache = createEnvCache<string>('TEST', 600);
      
      // Should work with custom TTL (can't easily test TTL value directly)
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should disable caching when ENABLED env var is false', () => {
      process.env.TEST_CACHE_ENABLED = 'false';

      const cache = createEnvCache<string>('TEST', 600);
      
      // Should not cache when disabled
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should disable caching when ENABLED env var is "0"', () => {
      process.env.TEST_CACHE_ENABLED = '0';

      const cache = createEnvCache<string>('TEST', 600);
      
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should enable caching when ENABLED env var is "1"', () => {
      process.env.TEST_CACHE_ENABLED = '1';

      const cache = createEnvCache<string>('TEST', 600);
      
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should handle invalid TTL values gracefully', () => {
      process.env.TEST_CACHE_TTL = 'invalid';
      process.env.TEST_CACHE_ENABLED = 'true';

      const cache = createEnvCache<string>('TEST', 600);
      
      // Should fall back to default TTL
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should clear work on environment-created cache', () => {
      process.env.TEST_CACHE_ENABLED = 'true';

      const cache = createEnvCache<string>('TEST', 600);
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });
});
