/**
 * Tests for Cache utility - Intelligent caching system
 * Tests TTL management, performance metrics, and cache operations
 */

import { CacheTTL, SimpleCache, globalCache } from '../src/utils/Cache.js';

describe('SimpleCache', () => {
  let cache: SimpleCache;

  beforeEach(() => {
    cache = new SimpleCache({
      maxSize: 5,
      defaultTTL: 1000, // 1 second for testing
      cleanupInterval: 100, // 100ms cleanup
    });
  });

  afterEach(() => {
    cache.clear();
    cache.stopCleanupTimer();
    // Give time for any pending timers to clear
    jest.clearAllTimers();
  });

  describe('Basic Operations', () => {
    test('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    test('should handle complex values', () => {
      const complexValue = {
        data: [1, 2, 3],
        meta: { timestamp: Date.now() }
      };
      cache.set('complex', complexValue);
      expect(cache.get('complex')).toEqual(complexValue);
    });

    test('should check if key exists', () => {
      cache.set('exists', 'value');
      expect(cache.has('exists')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    test('should delete keys', () => {
      cache.set('deleteme', 'value');
      expect(cache.has('deleteme')).toBe(true);

      const deleted = cache.delete('deleteme');
      expect(deleted).toBe(true);
      expect(cache.has('deleteme')).toBe(false);
    });

    test('should clear all items', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('TTL Management', () => {
    beforeAll(() => {
      jest.useFakeTimers();
    });
    
    afterAll(() => {
      jest.useRealTimers();
    });
    
    test('should expire items after TTL', async () => {
      cache.set('shortlived', 'value', 50); // 50ms TTL
      expect(cache.get('shortlived')).toBe('value');

      jest.advanceTimersByTime(100);
      // Trigger cleanup
      cache['cleanup']();
      expect(cache.get('shortlived')).toBeNull();
    });

    test('should use default TTL when not specified', () => {
      const testCache = new SimpleCache({
        maxSize: 5,
        defaultTTL: 1000, // 1 second default
        cleanupInterval: 100, // 100ms cleanup
      });
      
      testCache.set('defaultttl', 'value');
      expect(testCache.get('defaultttl')).toBe('value');

      // Should still be there before default TTL
      jest.advanceTimersByTime(800); // Less than 1000ms
      testCache['cleanup']();
      expect(testCache.get('defaultttl')).toBe('value');

      // Should be expired after default TTL
      jest.advanceTimersByTime(300); // Now at 1100ms, past the 1000ms TTL
      testCache['cleanup']();
      expect(testCache.get('defaultttl')).toBeNull();
      
      // Clean up timer
      testCache.stopCleanupTimer();
    });

    test('should handle custom TTL per item', () => {
      cache.set('long', 'value', 2000);
      cache.set('short', 'value', 50);

      jest.advanceTimersByTime(100);
      cache['cleanup']();
      expect(cache.get('long')).toBe('value');
      expect(cache.get('short')).toBeNull();
    });
  });

  describe('Size Management', () => {
    test('should evict oldest items when max size reached', () => {
      // Fill cache to capacity
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      expect(cache.size()).toBe(5);

      // Add one more item - should evict oldest
      cache.set('key5', 'value5');
      expect(cache.size()).toBe(5);
      expect(cache.get('key0')).toBeNull(); // Oldest should be evicted
      expect(cache.get('key5')).toBe('value5'); // Newest should be there
    });

    test('should not evict when updating existing key', () => {
      // Fill cache to capacity
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Update existing key
      cache.set('key0', 'updated');
      expect(cache.size()).toBe(5);
      expect(cache.get('key0')).toBe('updated');
    });
  });

  describe('Statistics', () => {
    test('should track hit and miss statistics', () => {
      cache.set('hit1', 'value1');
      cache.set('hit2', 'value2');

      // Generate hits
      cache.get('hit1');
      cache.get('hit1');
      cache.get('hit2');

      // Generate misses
      cache.get('miss1');
      cache.get('miss2');

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.6); // 3/5
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
    });

    test('should track evictions', () => {
      // Fill cache beyond capacity to trigger evictions
      for (let i = 0; i < 7; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const stats = cache.getStats();
      expect(stats.evictions).toBe(2); // Should have evicted 2 items
      expect(stats.size).toBe(5); // Should be at max size
    });

    test('should calculate hit rate correctly', () => {
      const stats1 = cache.getStats();
      expect(stats1.hitRate).toBe(0); // No requests yet

      cache.set('test', 'value');
      cache.get('test'); // hit
      cache.get('missing'); // miss

      const stats2 = cache.getStats();
      expect(stats2.hitRate).toBe(0.5); // 1 hit, 1 miss
    });
  });

  describe('Key Generation', () => {
    test('should generate consistent keys from parameters', () => {
      const params1 = { q: 'test', page: 1, sort: 'date' };
      const params2 = { sort: 'date', q: 'test', page: 1 }; // Different order

      const key1 = SimpleCache.generateKey('search', params1);
      const key2 = SimpleCache.generateKey('search', params2);

      expect(key1).toBe(key2); // Should be same despite different order
      expect(key1).toContain('search');
      expect(key1).toContain('q:test');
      expect(key1).toContain('page:1');
    });

    test('should handle arrays in parameters', () => {
      const params = {
        include: ['headline', 'body'],
        exclude: ['associations', 'renditions'],
      };

      const key = SimpleCache.generateKey('content', params);
      expect(key).toContain('include:body,headline'); // Arrays are sorted within their key
      expect(key).toContain('exclude:associations,renditions');
    });

    test('should ignore null and undefined values', () => {
      const params = {
        q: 'test',
        page: undefined,
        sort: null,
        limit: 10,
      };

      const key = SimpleCache.generateKey('search', params);
      expect(key).not.toContain('undefined');
      expect(key).not.toContain('null');
      expect(key).toContain('q:test');
      expect(key).toContain('limit:10');
    });
  });

  describe('getOrSet Pattern', () => {
    test('should execute function when key not found', async () => {
      const expensiveOperation = jest.fn().mockResolvedValue('computed value');

      const result = await cache.getOrSet('compute', expensiveOperation, 1000);

      expect(result).toBe('computed value');
      expect(expensiveOperation).toHaveBeenCalledTimes(1);
      expect(cache.get('compute')).toBe('computed value');
    });

    test('should return cached value without executing function', async () => {
      const expensiveOperation = jest.fn().mockResolvedValue('computed value');

      // Set initial value
      cache.set('compute', 'cached value');

      const result = await cache.getOrSet('compute', expensiveOperation, 1000);

      expect(result).toBe('cached value');
      expect(expensiveOperation).not.toHaveBeenCalled();
    });

    test('should handle async function execution', async () => {
      const asyncOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      };

      const result = await cache.getOrSet('async', asyncOperation);
      expect(result).toBe('async result');
      expect(cache.get('async')).toBe('async result');
    });
  });

  describe('Cleanup Process', () => {
    test('should automatically clean up expired items', () => {
      const testCache = new SimpleCache({
        maxSize: 5,
        defaultTTL: 1000,
        cleanupInterval: 50,
      });
      
      // Set items with past expiration times to simulate expired items
      const now = Date.now();
      testCache.set('expire1', 'value1');
      testCache.set('expire2', 'value2');
      testCache.set('keep', 'value3');
      
      // Manually expire the first two items by manipulating their expiration time
      const cache = testCache as any;
      cache.cache.get('expire1').expires = now - 1000;
      cache.cache.get('expire2').expires = now - 1000;

      expect(testCache.size()).toBe(3);

      // Manual cleanup should remove expired items
      testCache['cleanup']();

      expect(testCache.size()).toBe(1); // Only 'keep' should remain
      expect(testCache.get('keep')).toBe('value3');
      
      // Clean up timer
      testCache.stopCleanupTimer();
    });

    test('should stop cleanup timer when requested', () => {
      const cache2 = new SimpleCache({ cleanupInterval: 50 });
      expect(cache2['cleanupTimer']).toBeDefined();

      cache2.stopCleanupTimer();
      expect(cache2['cleanupTimer']).toBeNull();
    });
  });
});

describe('Global Cache Instance', () => {
  afterEach(() => {
    globalCache.clear();
  });
  
  afterAll(() => {
    // Stop the global cache timer to prevent Jest from hanging
    globalCache.stopCleanupTimer();
  });

  test('should be properly configured', () => {
    const stats = globalCache.getStats();
    expect(stats.maxSize).toBe(500);
  });

  test('should work across multiple operations', () => {
    globalCache.set('global1', 'value1');
    globalCache.set('global2', 'value2');

    expect(globalCache.get('global1')).toBe('value1');
    expect(globalCache.get('global2')).toBe('value2');
    expect(globalCache.size()).toBe(2);
  });
});

describe('Cache TTL Constants', () => {
  test('should have appropriate TTL values', () => {
    expect(CacheTTL.TRENDING_ANALYSIS).toBe(5 * 60 * 1000); // 5 minutes
    expect(CacheTTL.BULK_OPERATIONS).toBe(2 * 60 * 1000);   // 2 minutes
    expect(CacheTTL.SEARCH_RESULTS).toBe(1 * 60 * 1000);    // 1 minute
    expect(CacheTTL.CONTENT_ITEMS).toBe(30 * 1000);         // 30 seconds
  });

  test('should have trending analysis as longest TTL', () => {
    const ttlValues = Object.values(CacheTTL);
    const maxTTL = Math.max(...ttlValues);
    expect(CacheTTL.TRENDING_ANALYSIS).toBe(maxTTL);
  });
});
