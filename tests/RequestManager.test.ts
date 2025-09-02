/**
 * Tests for RequestManager utility
 * Covers request lifecycle management, abort controller handling, and cleanup
 */

import { RequestManager, globalRequestManager } from '../src/utils/RequestManager.js';

describe('RequestManager', () => {
  let manager: RequestManager;

  beforeEach(() => {
    manager = new RequestManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('createRequest', () => {
    test('should create a new request with AbortSignal', () => {
      const signal = manager.createRequest('test-1');
      
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
      expect(manager.isActive('test-1')).toBe(true);
    });

    test('should cancel existing request with same ID', () => {
      const signal1 = manager.createRequest('test-1');
      const signal2 = manager.createRequest('test-1');
      
      expect(signal1.aborted).toBe(true);
      expect(signal2.aborted).toBe(false);
      expect(manager.getActiveCount()).toBe(1);
    });

    test('should clean up when request is aborted', (done) => {
      const signal = manager.createRequest('test-1');
      
      signal.addEventListener('abort', () => {
        // Give it a moment to clean up
        setTimeout(() => {
          expect(manager.isActive('test-1')).toBe(false);
          done();
        }, 0);
      });
      
      manager.cancelRequest('test-1');
    });

    test('should handle multiple concurrent requests', () => {
      const signal1 = manager.createRequest('test-1');
      const signal2 = manager.createRequest('test-2');
      const signal3 = manager.createRequest('test-3');
      
      expect(manager.getActiveCount()).toBe(3);
      expect(signal1.aborted).toBe(false);
      expect(signal2.aborted).toBe(false);
      expect(signal3.aborted).toBe(false);
    });
  });

  describe('cancelRequest', () => {
    test('should cancel active request and return true', () => {
      manager.createRequest('test-1');
      
      const result = manager.cancelRequest('test-1');
      
      expect(result).toBe(true);
      expect(manager.isActive('test-1')).toBe(false);
    });

    test('should return false for non-existent request', () => {
      const result = manager.cancelRequest('non-existent');
      
      expect(result).toBe(false);
    });

    test('should return false for already aborted request', () => {
      const signal = manager.createRequest('test-1');
      manager.cancelRequest('test-1');
      
      // Try to cancel again
      const result = manager.cancelRequest('test-1');
      
      expect(result).toBe(false);
    });

    test('should remove request from active map', () => {
      manager.createRequest('test-1');
      manager.createRequest('test-2');
      
      manager.cancelRequest('test-1');
      
      expect(manager.isActive('test-1')).toBe(false);
      expect(manager.isActive('test-2')).toBe(true);
      expect(manager.getActiveCount()).toBe(1);
    });
  });

  describe('cancelAll', () => {
    test('should cancel all active requests', () => {
      const signal1 = manager.createRequest('test-1');
      const signal2 = manager.createRequest('test-2');
      const signal3 = manager.createRequest('test-3');
      
      manager.cancelAll();
      
      expect(signal1.aborted).toBe(true);
      expect(signal2.aborted).toBe(true);
      expect(signal3.aborted).toBe(true);
      expect(manager.getActiveCount()).toBe(0);
    });

    test('should handle empty state gracefully', () => {
      expect(() => manager.cancelAll()).not.toThrow();
      expect(manager.getActiveCount()).toBe(0);
    });

    test('should handle mix of active and aborted requests', () => {
      const signal1 = manager.createRequest('test-1');
      const signal2 = manager.createRequest('test-2');
      
      // Manually abort one
      manager.cancelRequest('test-1');
      
      // Cancel all should handle the remaining
      manager.cancelAll();
      
      expect(signal2.aborted).toBe(true);
      expect(manager.getActiveCount()).toBe(0);
    });
  });

  describe('getActiveCount', () => {
    test('should return correct count of active requests', () => {
      expect(manager.getActiveCount()).toBe(0);
      
      manager.createRequest('test-1');
      expect(manager.getActiveCount()).toBe(1);
      
      manager.createRequest('test-2');
      expect(manager.getActiveCount()).toBe(2);
      
      manager.cancelRequest('test-1');
      expect(manager.getActiveCount()).toBe(1);
    });

    test('should clean up aborted requests that were not removed', () => {
      // Create requests
      manager.createRequest('test-1');
      manager.createRequest('test-2');
      
      // Directly access the internal map to simulate an aborted controller
      // that wasn't cleaned up properly
      const activeRequests = (manager as any).activeRequests;
      const controller = activeRequests.get('test-1');
      if (controller) {
        controller.abort();
        // Don't delete from map to simulate cleanup scenario
      }
      
      // getActiveCount should clean it up
      const count = manager.getActiveCount();
      expect(count).toBe(1);
      expect(manager.isActive('test-1')).toBe(false);
      expect(manager.isActive('test-2')).toBe(true);
    });
  });

  describe('isActive', () => {
    test('should return true for active request', () => {
      manager.createRequest('test-1');
      
      expect(manager.isActive('test-1')).toBe(true);
    });

    test('should return false for non-existent request', () => {
      expect(manager.isActive('non-existent')).toBe(false);
    });

    test('should return false for aborted request', () => {
      manager.createRequest('test-1');
      manager.cancelRequest('test-1');
      
      expect(manager.isActive('test-1')).toBe(false);
    });

    test('should handle checking status of replaced request', () => {
      const signal1 = manager.createRequest('test-1');
      const signal2 = manager.createRequest('test-1'); // Replace
      
      expect(manager.isActive('test-1')).toBe(true);
      expect(signal1.aborted).toBe(true);
      expect(signal2.aborted).toBe(false);
    });
  });

  describe('destroy', () => {
    test('should cancel all requests and clean up', () => {
      const signal1 = manager.createRequest('test-1');
      const signal2 = manager.createRequest('test-2');
      
      manager.destroy();
      
      expect(signal1.aborted).toBe(true);
      expect(signal2.aborted).toBe(true);
      expect(manager.getActiveCount()).toBe(0);
    });

    test('should be idempotent', () => {
      manager.createRequest('test-1');
      
      manager.destroy();
      manager.destroy(); // Should not throw
      
      expect(manager.getActiveCount()).toBe(0);
    });
  });

  describe('globalRequestManager', () => {
    test('should export a global instance', () => {
      expect(globalRequestManager).toBeInstanceOf(RequestManager);
    });

    test('should be usable for managing requests', () => {
      const signal = globalRequestManager.createRequest('global-test');
      
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(globalRequestManager.isActive('global-test')).toBe(true);
      
      // Clean up
      globalRequestManager.cancelRequest('global-test');
    });
  });

  describe('Edge cases and integration scenarios', () => {
    test('should handle rapid creation and cancellation', () => {
      for (let i = 0; i < 100; i++) {
        const signal = manager.createRequest(`rapid-${i}`);
        if (i % 2 === 0) {
          manager.cancelRequest(`rapid-${i}`);
        }
      }
      
      // Should have 50 active requests
      expect(manager.getActiveCount()).toBe(50);
      
      manager.cancelAll();
      expect(manager.getActiveCount()).toBe(0);
    });

    test('should handle request ID reuse', () => {
      const signal1 = manager.createRequest('reused');
      manager.cancelRequest('reused');
      
      const signal2 = manager.createRequest('reused');
      
      expect(signal1.aborted).toBe(true);
      expect(signal2.aborted).toBe(false);
      expect(manager.isActive('reused')).toBe(true);
    });

    test('should work with fetch-like usage pattern', async () => {
      const signal = manager.createRequest('fetch-test');
      
      // Simulate a fetch that checks abort status
      const mockFetch = () => {
        return new Promise((resolve, reject) => {
          if (signal.aborted) {
            reject(new Error('Aborted'));
          } else {
            signal.addEventListener('abort', () => {
              reject(new Error('Aborted'));
            });
            
            // Simulate network delay
            setTimeout(() => {
              if (!signal.aborted) {
                resolve('Success');
              }
            }, 10);
          }
        });
      };
      
      // Start fetch
      const fetchPromise = mockFetch();
      
      // Cancel before completion
      manager.cancelRequest('fetch-test');
      
      // Should reject with abort error
      await expect(fetchPromise).rejects.toThrow('Aborted');
    });
  });
});