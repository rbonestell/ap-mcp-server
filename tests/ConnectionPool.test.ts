import { ConnectionPool } from '../src/http/ConnectionPool.js';
import { APConfigManager } from '../src/config/APConfig.js';
import { APHttpClient } from '../src/http/APHttpClient.js';

// Mock APHttpClient
jest.mock('../src/http/APHttpClient.js');

describe('ConnectionPool', () => {
  let pool: ConnectionPool;
  let mockHttpClients: jest.Mocked<APHttpClient>[];
  let clientIndex: number;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create multiple mock HTTP clients
    mockHttpClients = [];
    clientIndex = 0;
    
    // Mock the constructor to return different instances
    (APHttpClient as jest.MockedClass<typeof APHttpClient>).mockImplementation(() => {
      const client = {
        cleanup: jest.fn(),
      } as any;
      mockHttpClients.push(client);
      clientIndex++;
      return client;
    });
    
    // Create pool
    pool = new ConnectionPool(3);
  });

  afterEach(() => {
    pool.cleanup();
  });

  describe('Connection Acquisition', () => {
    test('should create new connection for new config', () => {
      const config = new APConfigManager({ apiKey: 'test-key-1' });
      
      const client = pool.acquire(config);
      
      expect(client).toBe(mockHttpClients[0]);
      expect(APHttpClient).toHaveBeenCalledTimes(1);
      expect(APHttpClient).toHaveBeenCalledWith(config);
    });

    test('should reuse connection for same config', () => {
      const config = new APConfigManager({ apiKey: 'test-key-1' });
      
      const client1 = pool.acquire(config);
      const client2 = pool.acquire(config);
      
      expect(client1).toBe(client2);
      expect(APHttpClient).toHaveBeenCalledTimes(1);
    });

    test('should create different connections for different API keys', () => {
      const config1 = new APConfigManager({ apiKey: 'test-key-1' });
      const config2 = new APConfigManager({ apiKey: 'test-key-2' });
      
      const client1 = pool.acquire(config1);
      const client2 = pool.acquire(config2);
      
      expect(client1).toBe(mockHttpClients[0]);
      expect(client2).toBe(mockHttpClients[1]);
      expect(APHttpClient).toHaveBeenCalledTimes(2);
    });

    test('should create different connections for different base URLs', () => {
      const config1 = new APConfigManager({ apiKey: 'test-key-1', baseUrl: 'https://api1.example.com' });
      const config2 = new APConfigManager({ apiKey: 'test-key-1', baseUrl: 'https://api2.example.com' });
      
      pool.acquire(config1);
      pool.acquire(config2);
      
      expect(APHttpClient).toHaveBeenCalledTimes(2);
    });
  });

  describe('Connection Eviction', () => {
    test('should evict least used connection when pool is full', () => {
      const config1 = new APConfigManager({ apiKey: 'test-key-1' });
      const config2 = new APConfigManager({ apiKey: 'test-key-2' });
      const config3 = new APConfigManager({ apiKey: 'test-key-3' });
      const config4 = new APConfigManager({ apiKey: 'test-key-4' });
      
      // Fill the pool (max 3)
      pool.acquire(config1);
      pool.acquire(config2);
      pool.acquire(config3);
      
      // Use connection 2 and 3 again to increase usage
      pool.acquire(config2);
      pool.acquire(config3);
      
      // This should evict connection 1 (least used)
      pool.acquire(config4);
      
      expect(mockHttpClients[0].cleanup).toHaveBeenCalledTimes(1);
      expect(APHttpClient).toHaveBeenCalledTimes(4);
    });

    test('should evict oldest connection when usage is equal', () => {
      const config1 = new APConfigManager({ apiKey: 'test-key-1' });
      const config2 = new APConfigManager({ apiKey: 'test-key-2' });
      const config3 = new APConfigManager({ apiKey: 'test-key-3' });
      const config4 = new APConfigManager({ apiKey: 'test-key-4' });
      
      // Fill the pool with equal usage
      pool.acquire(config1);
      
      // Small delay to ensure different timestamps
      jest.advanceTimersByTime(100);
      pool.acquire(config2);
      
      jest.advanceTimersByTime(100);
      pool.acquire(config3);
      
      // This should evict connection 1 (oldest)
      pool.acquire(config4);
      
      expect(mockHttpClients[0].cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Connection Release', () => {
    test('should update timestamp on release', () => {
      const config = new APConfigManager({ apiKey: 'test-key-1' });
      
      pool.acquire(config);
      const stats1 = pool.getStats();
      const initialLastUsed = stats1.connections[0].lastUsed;
      
      // Advance time
      jest.advanceTimersByTime(1000);
      
      pool.release(config);
      const stats2 = pool.getStats();
      const updatedLastUsed = stats2.connections[0].lastUsed;
      
      expect(updatedLastUsed).toBeGreaterThan(initialLastUsed);
    });
  });

  describe('Pool Statistics', () => {
    test('should provide accurate statistics', () => {
      const config1 = new APConfigManager({ apiKey: 'test-key-1' });
      const config2 = new APConfigManager({ apiKey: 'test-key-2' });
      
      pool.acquire(config1);
      pool.acquire(config1); // Use again
      pool.acquire(config2);
      
      const stats = pool.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.maxConnections).toBe(3);
      expect(stats.connections).toHaveLength(2);
      
      const conn1 = stats.connections.find(c => c.key.startsWith('test-key'));
      expect(conn1).toBeDefined();
      expect(conn1!.usage).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    test('should clean up idle connections periodically', () => {
      jest.useFakeTimers();
      
      // Create a new pool with fake timers active
      const testPool = new ConnectionPool(3);
      
      const config1 = new APConfigManager({ apiKey: 'test-key-1' });
      const config2 = new APConfigManager({ apiKey: 'test-key-2' });
      
      testPool.acquire(config1);
      testPool.acquire(config2);
      
      // Advance time beyond idle timeout (5 minutes) plus cleanup interval (1 minute)
      jest.advanceTimersByTime(6 * 60 * 1000);
      
      expect(mockHttpClients[0].cleanup).toHaveBeenCalledTimes(1);
      expect(mockHttpClients[1].cleanup).toHaveBeenCalledTimes(1);
      
      testPool.cleanup();
      jest.useRealTimers();
    });

    test('should clear all connections on cleanup', () => {
      const config1 = new APConfigManager({ apiKey: 'test-key-1' });
      const config2 = new APConfigManager({ apiKey: 'test-key-2' });
      
      pool.acquire(config1);
      pool.acquire(config2);
      
      pool.cleanup();
      
      expect(mockHttpClients[0].cleanup).toHaveBeenCalledTimes(1);
      expect(mockHttpClients[1].cleanup).toHaveBeenCalledTimes(1);
      
      const stats = pool.getStats();
      expect(stats.size).toBe(0);
    });

    test('should stop cleanup timer on cleanup', () => {
      jest.useFakeTimers();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      const newPool = new ConnectionPool(3);
      newPool.cleanup();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
      jest.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero max connections gracefully', () => {
      const poolWithZero = new ConnectionPool(0);
      expect(poolWithZero.getStats().maxConnections).toBe(5); // Should use default
      poolWithZero.cleanup();
    });

    test('should handle negative max connections gracefully', () => {
      const poolWithNegative = new ConnectionPool(-1);
      expect(poolWithNegative.getStats().maxConnections).toBe(5); // Should use default
      poolWithNegative.cleanup();
    });

    test('should handle clear on empty pool', () => {
      expect(() => pool.clear()).not.toThrow();
      expect(pool.getStats().size).toBe(0);
    });
  });
});