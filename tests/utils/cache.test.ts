import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { Cache, createEnvCache } from '../../src/utils/cache.js';

describe('Cache Utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.useFakeTimers();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
  });

  describe('Cache class', () => {
    it('should store and retrieve values', () => {
      const cache = new Cache<string>(1000);

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      const cache = new Cache<string>(1000);

      expect(cache.get('non-existent')).toBeUndefined();
    });

    it('should expire items after TTL', () => {
      const cache = new Cache<string>(1000);

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Advance time by 1001ms
      vi.advanceTimersByTime(1001);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should delete items', () => {
      const cache = new Cache<string>(1000);

      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);

      cache.delete('key1');
      expect(cache.has('key1')).toBe(false);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should clear all items', () => {
      const cache = new Cache<string>(1000);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should return cache keys', () => {
      const cache = new Cache<string>(1000);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const keys = cache.keys();
      expect(keys).toHaveLength(2);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should disable caching when enabled is false', () => {
      const cache = new Cache<string>(1000, false);

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.size()).toBe(0);
    });

    it('should toggle caching on/off', () => {
      const cache = new Cache<string>(1000, true);

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      cache.setEnabled(false);
      expect(cache.isEnabled()).toBe(false);
      expect(cache.size()).toBe(0); // Should clear when disabled

      cache.set('key2', 'value2');
      expect(cache.get('key2')).toBeUndefined();

      cache.setEnabled(true);
      cache.set('key3', 'value3');
      expect(cache.get('key3')).toBe('value3');
    });

    it('should update default TTL', () => {
      const cache = new Cache<string>(1000);

      expect(cache.getDefaultTtl()).toBe(1000);

      cache.setDefaultTtl(2000);
      expect(cache.getDefaultTtl()).toBe(2000);
    });
  });

  describe('createEnvCache factory', () => {
    it('should create cache with environment-based configuration', () => {
      process.env.TEST_CACHE_ENABLED = 'true';
      process.env.TEST_CACHE_TIMEOUT = '5'; // 5 seconds

      const cache = createEnvCache<string>('TEST', 1);

      expect(cache.isEnabled()).toBe(true);
      expect(cache.getDefaultTtl()).toBe(5000); // Should be converted to milliseconds
    });

    it('should disable cache when env var is false', () => {
      process.env.TEST_CACHE_ENABLED = 'false';

      const cache = createEnvCache<string>('TEST', 1);

      expect(cache.isEnabled()).toBe(false);
    });

    it('should use default TTL when env var is not set', () => {
      delete process.env.TEST_CACHE_TIMEOUT;

      const cache = createEnvCache<string>('TEST', 2); // 2 seconds

      expect(cache.getDefaultTtl()).toBe(2000); // Should be converted to milliseconds
    });

    it('should enable cache by default when env var is not set', () => {
      delete process.env.TEST_CACHE_ENABLED;

      const cache = createEnvCache<string>('TEST', 1);

      expect(cache.isEnabled()).toBe(true);
    });

    it('should handle invalid timeout values gracefully', () => {
      process.env.TEST_CACHE_TIMEOUT = 'invalid';

      const cache = createEnvCache<string>('TEST', 2); // 2 seconds

      // Should fall back to default when parsing fails
      expect(cache.getDefaultTtl()).toBe(2000); // Should be converted to milliseconds
    });

    it('should default to 10 minutes when no default provided', () => {
      delete process.env.TEST_CACHE_TIMEOUT;

      const cache = createEnvCache<string>('TEST'); // No default provided

      expect(cache.getDefaultTtl()).toBe(600000); // 10 minutes in milliseconds
    });
  });
});
