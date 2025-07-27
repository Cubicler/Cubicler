/**
 * Generic caching utility for Cubicler services
 */

interface CacheItem<T> {
  value: T;
  timestamp: number;
}

export class Cache<T> {
  private cache: Map<string, CacheItem<T>> = new Map();
  private defaultTtl: number;
  private enabled: boolean;

  constructor(defaultTtl: number = 300000, enabled: boolean = true) {
    this.defaultTtl = defaultTtl;
    this.enabled = enabled;
  }

  /**
   * Get an item from cache
   * @param key - The cache key
   * @returns The cached item or undefined if not found/expired
   */
  get(key: string): T | undefined {
    if (!this.enabled) {
      return undefined;
    }

    const item = this.cache.get(key);
    if (!item) {
      return undefined;
    }

    const now = Date.now();

    if (now - item.timestamp > this.defaultTtl) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  /**
   * Set an item in cache
   * @param key - The cache key
   * @param value - The value to cache
   */
  set(key: string, value: T): void {
    if (!this.enabled) {
      return;
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Delete an item from cache
   * @param key - The cache key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Check if an item exists in cache (regardless of expiration)
   * @param key - The cache key
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Enable or disable caching
   * @param enabled - Whether caching should be enabled
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set default TTL
   * @param ttl - Time to live in milliseconds
   */
  setDefaultTtl(ttl: number): void {
    this.defaultTtl = ttl;
  }

  /**
   * Get default TTL
   */
  getDefaultTtl(): number {
    return this.defaultTtl;
  }
}

/**
 * Factory function to create cache instances with environment-based configuration
 * @param envPrefix - Environment variable prefix (e.g., "PROVIDER_SPEC" for PROVIDER_SPEC_CACHE_ENABLED)
 * @param defaultTtlSeconds - Default TTL in seconds
 * @returns Configured cache instance
 */
export function createEnvCache<T>(envPrefix: string, defaultTtlSeconds: number = 600): Cache<T> {
  const enabled = process.env[`${envPrefix}_CACHE_ENABLED`] !== 'false';
  const timeoutEnv = process.env[`${envPrefix}_CACHE_TIMEOUT`];
  const ttlSeconds = timeoutEnv ? parseInt(timeoutEnv) : defaultTtlSeconds;

  // Use default TTL if parsing failed (NaN)
  const finalTtlSeconds = isNaN(ttlSeconds) ? defaultTtlSeconds : ttlSeconds;

  // Convert seconds to milliseconds for internal use
  const ttlMs = finalTtlSeconds * 1000;

  return new Cache<T>(ttlMs, enabled);
}
