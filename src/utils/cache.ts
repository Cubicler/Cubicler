interface CacheItem<T> {
  value: T;
  timestamp: number;
}

export class Cache<T> {
  private cache: Map<string, CacheItem<T>> = new Map();
  private defaultTtl: number;
  private enabled: boolean;

  /**
   * Creates a new cache instance
   * @param defaultTtl - Default time to live in milliseconds (default: 300000ms = 5 minutes)
   * @param enabled - Whether caching is enabled by default (default: true)
   */
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
   * @returns void
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
   * @returns true if the item was deleted, false if it didn't exist
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from cache
   * @returns void
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Check if an item exists in cache (regardless of expiration)
   * @param key - The cache key
   * @returns true if the key exists in cache, false otherwise
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get cache size
   * @returns The number of items currently in the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all cache keys
   * @returns An array of all cache keys currently stored
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Enable or disable caching
   * @param enabled - Whether caching should be enabled
   * @returns void
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Check if caching is enabled
   * @returns true if caching is enabled, false otherwise
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set default TTL
   * @param ttl - Time to live in milliseconds
   * @returns void
   */
  setDefaultTtl(ttl: number): void {
    this.defaultTtl = ttl;
  }

  /**
   * Get default TTL
   * @returns The default time to live in milliseconds
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
  const enabledValue = process.env[`${envPrefix}_CACHE_ENABLED`];
  const enabled = enabledValue !== 'false' && enabledValue !== '0';
  const timeoutEnv = process.env[`${envPrefix}_CACHE_TIMEOUT`];
  const ttlSeconds = timeoutEnv ? parseInt(timeoutEnv) : defaultTtlSeconds;

  // Use default TTL if parsing failed (NaN)
  const finalTtlSeconds = isNaN(ttlSeconds) ? defaultTtlSeconds : ttlSeconds;

  // Convert seconds to milliseconds for internal use
  const ttlMs = finalTtlSeconds * 1000;

  return new Cache<T>(ttlMs, enabled);
}
