import { APConfigManager } from '../config/APConfig.js';
import { APHttpClient } from './APHttpClient.js';

/**
 * Connection pool for HTTP clients
 * Reuses connections based on API key to improve performance
 */
export class ConnectionPool {
  private readonly pool: Map<string, APHttpClient> = new Map();
  private readonly maxConnections: number = 5;
  private readonly connectionTimestamps: Map<string, number> = new Map();
  private readonly connectionUsage: Map<string, number> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private readonly maxIdleTime = 5 * 60 * 1000; // 5 minutes

  constructor(maxConnections?: number) {
    if (maxConnections && maxConnections > 0) {
      this.maxConnections = maxConnections;
    }
    this.startCleanupTimer();
  }

  /**
   * Get a connection key from configuration
   * Uses first 12 chars of API key + base URL for uniqueness
   */
  private getConnectionKey(config: APConfigManager): string {
    const apiKey = config.get('apiKey');
    const baseUrl = config.get('baseUrl');
    // Use first 12 chars to better differentiate between keys like 'test-key-1' and 'test-key-2'
    const keyPrefix = apiKey.substring(0, 12);
    return `${keyPrefix}:${baseUrl}`;
  }

  /**
   * Acquire an HTTP client from the pool
   * Reuses existing connections or creates new ones
   */
  acquire(config: APConfigManager): APHttpClient {
    const key = this.getConnectionKey(config);

    // Check if we have an existing connection
    if (this.pool.has(key)) {
      const client = this.pool.get(key)!;
      this.connectionTimestamps.set(key, Date.now());
      this.connectionUsage.set(key, (this.connectionUsage.get(key) || 0) + 1);
      return client;
    }

    // Check if we need to evict a connection
    if (this.pool.size >= this.maxConnections) {
      this.evictLeastUsed();
    }

    // Create new connection
    const client = new APHttpClient(config);
    this.pool.set(key, client);
    this.connectionTimestamps.set(key, Date.now());
    this.connectionUsage.set(key, 1);

    return client;
  }

  /**
   * Release a connection (mark as available)
   * Connection stays in pool for reuse
   */
  release(config: APConfigManager): void {
    const key = this.getConnectionKey(config);
    this.connectionTimestamps.set(key, Date.now());
  }

  /**
   * Evict the least recently used connection
   */
  private evictLeastUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    let lowestUsage = Infinity;

    // Find the least recently used connection with lowest usage count
    for (const [key, timestamp] of this.connectionTimestamps.entries()) {
      const usage = this.connectionUsage.get(key) || 0;
      if (timestamp < oldestTime || (timestamp === oldestTime && usage < lowestUsage)) {
        oldestTime = timestamp;
        oldestKey = key;
        lowestUsage = usage;
      }
    }

    if (oldestKey) {
      this.remove(oldestKey);
    }
  }

  /**
   * Remove a connection from the pool
   */
  private remove(key: string): void {
    const client = this.pool.get(key);
    if (client) {
      client.cleanup();
      this.pool.delete(key);
      this.connectionTimestamps.delete(key);
      this.connectionUsage.delete(key);
    }
  }

  /**
   * Start periodic cleanup of idle connections
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Check every minute
  }

  /**
   * Clean up connections that have been idle too long
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (const [key, timestamp] of this.connectionTimestamps.entries()) {
      if (now - timestamp > this.maxIdleTime) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.remove(key);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    size: number;
    maxConnections: number;
    connections: Array<{
      key: string;
      usage: number;
      lastUsed: number;
      idleTime: number;
    }>;
  } {
    const now = Date.now();
    const connections = Array.from(this.pool.keys()).map(key => ({
      key,
      usage: this.connectionUsage.get(key) || 0,
      lastUsed: this.connectionTimestamps.get(key) || 0,
      idleTime: now - (this.connectionTimestamps.get(key) || 0),
    }));

    return {
      size: this.pool.size,
      maxConnections: this.maxConnections,
      connections,
    };
  }

  /**
   * Clear all connections
   */
  clear(): void {
    for (const client of this.pool.values()) {
      client.cleanup();
    }
    this.pool.clear();
    this.connectionTimestamps.clear();
    this.connectionUsage.clear();
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }
}
