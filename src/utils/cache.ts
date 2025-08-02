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
   * @throws Error if key is invalid
   */
  get(key: string): T | undefined {
    this.validateKey(key);

    if (!this.enabled) {
      return undefined;
    }

    const item = this.cache.get(key);
    if (!item) {
      return undefined;
    }

    if (this.isExpired(item)) {
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
   * @throws Error if inputs are invalid
   */
  set(key: string, value: T): void {
    this.validateKey(key);

    if (value === undefined) {
      throw new Error('Cannot cache undefined values');
    }

    if (!this.enabled) {
      return;
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Validate cache key
   * @param key - Key to validate
   * @throws Error if key is invalid
   */
  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Cache key must be a non-empty string');
    }
  }

  /**
   * Check if cache item is expired
   * @param item - Cache item to check
   * @returns true if expired
   */
  private isExpired(item: CacheItem<T>): boolean {
    const now = Date.now();
    return now - item.timestamp > this.defaultTtl;
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
 * @throws Error if inputs are invalid
 */
export function createEnvCache<T>(envPrefix: string, defaultTtlSeconds: number = 600): Cache<T> {
  validateEnvCacheInputs(envPrefix, defaultTtlSeconds);

  const enabled = determineEnabledState(envPrefix);
  const ttlSeconds = determineTtlSeconds(envPrefix, defaultTtlSeconds);

  // Convert seconds to milliseconds for internal use
  const ttlMs = ttlSeconds * 1000;

  return new Cache<T>(ttlMs, enabled);
}

/**
 * Validate inputs for createEnvCache
 * @param envPrefix - Environment prefix to validate
 * @param defaultTtlSeconds - Default TTL to validate
 * @throws Error if inputs are invalid
 */
function validateEnvCacheInputs(envPrefix: string, defaultTtlSeconds: number): void {
  if (!envPrefix || typeof envPrefix !== 'string') {
    throw new Error('Environment prefix must be a non-empty string');
  }

  if (
    typeof defaultTtlSeconds !== 'number' ||
    defaultTtlSeconds <= 0 ||
    !isFinite(defaultTtlSeconds)
  ) {
    throw new Error('Default TTL seconds must be a positive finite number');
  }
}

/**
 * Determine if cache should be enabled based on environment variable
 * @param envPrefix - Environment prefix
 * @returns true if cache should be enabled
 */
function determineEnabledState(envPrefix: string): boolean {
  const enabledValue = process.env[`${envPrefix}_CACHE_ENABLED`];
  return enabledValue !== 'false' && enabledValue !== '0';
}

/**
 * Determine TTL seconds from environment or use default
 * @param envPrefix - Environment prefix
 * @param defaultTtlSeconds - Default TTL seconds
 * @returns TTL seconds to use
 */
function determineTtlSeconds(envPrefix: string, defaultTtlSeconds: number): number {
  const timeoutEnv = process.env[`${envPrefix}_CACHE_TIMEOUT`];

  if (!timeoutEnv) {
    return defaultTtlSeconds;
  }

  const parsed = parseInt(timeoutEnv, 10);

  // Use default TTL if parsing failed (NaN) or value is invalid
  if (isNaN(parsed) || parsed <= 0) {
    console.warn(
      `⚠️ [Cache] Invalid cache timeout for ${envPrefix}: ${timeoutEnv}. Using default: ${defaultTtlSeconds}s`
    );
    return defaultTtlSeconds;
  }

  return parsed;
}
