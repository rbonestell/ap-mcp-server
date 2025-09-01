/**
 * Simple in-memory cache implementation with TTL management
 */

export interface CacheItem {
  value: any;
  expires: number;
  createdAt: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  maxSize: number;
}

/**
 * Simple cache implementation with TTL support and automatic cleanup
 * Designed for high-performance caching of expensive AP API operations
 */
export class SimpleCache {
  private cache = new Map<string, CacheItem>();
  private maxSize: number;
  private defaultTTL: number;
  private cleanupInterval: number;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(options: {
    maxSize?: number;
    defaultTTL?: number;
    cleanupInterval?: number;
    autoCleanup?: boolean;
  } = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes default
    this.cleanupInterval = options.cleanupInterval || 60 * 1000; // 1 minute cleanup

    // Only start timer if autoCleanup is not explicitly false
    // This allows for better control over resource management
    if (options.autoCleanup !== false) {
      // Don't start timer immediately - wait for first item
      // This prevents timer from running on empty cache
    }
  }

  /**
   * Set a value in the cache with optional TTL
   */
  set(key: string, value: any, ttlMs?: number): void {
    const now = Date.now();
    const ttl = ttlMs || this.defaultTTL;

    // Check if we need to evict items to make space
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expires: now + ttl,
      createdAt: now,
    });

    // Start cleanup timer if this is the first item
    this.manageCleanupTimer();
  }

  /**
   * Get a value from the cache
   * Returns null if not found or expired
   */
  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    if (now > item.expires) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return item.value;
  }

  /**
   * Check if a key exists in the cache (without updating stats)
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    
    // Stop cleanup timer when cache is cleared
    this.manageCleanupTimer();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 1000) / 1000,
      evictions: this.stats.evictions,
      maxSize: this.maxSize,
    };
  }

  /**
   * Get all keys in the cache (for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get the size of the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Generate a cache key from parameters
   * Useful for API calls with multiple parameters
   */
  static generateKey(prefix: string, params: Record<string, any>): string {
    // Sort keys for consistent hashing
    const sortedKeys = Object.keys(params).sort();
    const keyParts = [prefix];

    for (const key of sortedKeys) {
      const value = params[key];
      if (value !== undefined && value !== null) {
        // Handle arrays by joining
        if (Array.isArray(value)) {
          keyParts.push(`${key}:${value.sort().join(',')}`);
        } else {
          keyParts.push(`${key}:${value}`);
        }
      }
    }

    return keyParts.join('|');
  }

  /**
   * Get or set pattern - execute function if key not found
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fn();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Evict the oldest item from the cache
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.createdAt < oldestTime) {
        oldestTime = item.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Remove expired items from cache
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    // Stop timer if cache is now empty after cleanup
    this.manageCleanupTimer();
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Stop automatic cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Clean up resources (call this before disposing of the cache instance)
   * This method should be called when the cache is no longer needed
   * to prevent memory leaks from the cleanup timer
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.cache.clear();
  }

  /**
   * Enable automatic start/stop of cleanup timer based on cache usage
   * This prevents timers from running when cache is empty
   */
  private manageCleanupTimer(): void {
    if (this.cache.size > 0 && !this.cleanupTimer) {
      // Start timer if cache has items and timer is not running
      this.startCleanupTimer();
    } else if (this.cache.size === 0 && this.cleanupTimer) {
      // Stop timer if cache is empty
      this.stopCleanupTimer();
    }
  }
}

/**
 * Global cache instance for AP MCP Server
 * Pre-configured with optimal settings for API operations
 */
export const globalCache = new SimpleCache({
  maxSize: 500,
  defaultTTL: 2 * 60 * 1000, // 2 minutes default
  cleanupInterval: 30 * 1000, // 30 seconds cleanup
});

/**
 * Cache TTL constants for different operation types
 */
export const CacheTTL = {
  TRENDING_ANALYSIS: 5 * 60 * 1000,  // 5 minutes
  BULK_OPERATIONS: 2 * 60 * 1000,   // 2 minutes
  SEARCH_RESULTS: 1 * 60 * 1000,    // 1 minute
  CONTENT_ITEMS: 30 * 1000,         // 30 seconds
} as const;
