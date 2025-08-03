// Phase 4: Connection Pooling & Performance Optimization
interface PooledConnection {
  id: string;
  client: any;
  inUse: boolean;
  created: number;
  lastUsed: number;
  queryCount: number;
}

export class ConnectionPoolManager {
  private static pools: Map<string, PooledConnection[]> = new Map();
  private static readonly MAX_POOL_SIZE = 10;
  private static readonly CONNECTION_TTL = 300000; // 5 minutes
  private static readonly IDLE_TIMEOUT = 60000; // 1 minute

  static async getConnection(poolName: string, createFn: () => any): Promise<any> {
    let pool = this.pools.get(poolName);
    
    if (!pool) {
      pool = [];
      this.pools.set(poolName, pool);
    }

    // Clean up expired connections
    this.cleanupExpiredConnections(pool);

    // Find available connection
    let connection = pool.find(conn => !conn.inUse);

    if (!connection) {
      // Create new connection if pool not full
      if (pool.length < this.MAX_POOL_SIZE) {
        const client = await createFn();
        connection = {
          id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          client,
          inUse: true,
          created: Date.now(),
          lastUsed: Date.now(),
          queryCount: 0
        };
        pool.push(connection);
        console.log(`[ConnectionPool] Created new connection: ${connection.id} for pool: ${poolName}`);
      } else {
        // Wait for available connection or create temporary one
        connection = await this.waitForConnection(pool, createFn);
      }
    } else {
      connection.inUse = true;
      connection.lastUsed = Date.now();
    }

    return connection;
  }

  static releaseConnection(poolName: string, connectionId: string): void {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const connection = pool.find(conn => conn.id === connectionId);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
      connection.queryCount++;
      console.log(`[ConnectionPool] Released connection: ${connectionId}`);
    }
  }

  static async withConnection<T>(
    poolName: string, 
    createFn: () => any, 
    operation: (client: any) => Promise<T>
  ): Promise<T> {
    const connection = await this.getConnection(poolName, createFn);
    
    try {
      const result = await operation(connection.client);
      return result;
    } finally {
      this.releaseConnection(poolName, connection.id);
    }
  }

  private static cleanupExpiredConnections(pool: PooledConnection[]): void {
    const now = Date.now();
    const expiredIndices: number[] = [];

    for (let i = 0; i < pool.length; i++) {
      const conn = pool[i];
      const isExpired = now - conn.created > this.CONNECTION_TTL;
      const isIdle = !conn.inUse && now - conn.lastUsed > this.IDLE_TIMEOUT;
      
      if (isExpired || isIdle) {
        expiredIndices.push(i);
      }
    }

    // Remove expired connections in reverse order to maintain indices
    for (let i = expiredIndices.length - 1; i >= 0; i--) {
      const index = expiredIndices[i];
      const conn = pool[index];
      console.log(`[ConnectionPool] Cleaning up connection: ${conn.id} (expired: ${now - conn.created > this.CONNECTION_TTL}, idle: ${now - conn.lastUsed > this.IDLE_TIMEOUT})`);
      pool.splice(index, 1);
    }
  }

  private static async waitForConnection(
    pool: PooledConnection[], 
    createFn: () => any,
    timeout = 5000
  ): Promise<PooledConnection> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const available = pool.find(conn => !conn.inUse);
      if (available) {
        available.inUse = true;
        available.lastUsed = Date.now();
        return available;
      }
      
      // Wait 50ms before checking again
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Timeout reached, create temporary connection
    console.warn('[ConnectionPool] Timeout waiting for connection, creating temporary connection');
    const client = await createFn();
    return {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      client,
      inUse: true,
      created: Date.now(),
      lastUsed: Date.now(),
      queryCount: 0
    };
  }

  static getPoolStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [poolName, pool] of this.pools.entries()) {
      const now = Date.now();
      const totalConnections = pool.length;
      const activeConnections = pool.filter(conn => conn.inUse).length;
      const idleConnections = totalConnections - activeConnections;
      const avgAge = pool.length > 0 ? 
        pool.reduce((sum, conn) => sum + (now - conn.created), 0) / pool.length : 0;
      const totalQueries = pool.reduce((sum, conn) => sum + conn.queryCount, 0);

      stats[poolName] = {
        totalConnections,
        activeConnections,
        idleConnections,
        avgAgeMs: Math.round(avgAge),
        totalQueries,
        avgQueriesPerConnection: totalConnections > 0 ? Math.round(totalQueries / totalConnections) : 0
      };
    }

    return stats;
  }

  // Graceful shutdown - close all connections
  static async shutdown(): Promise<void> {
    console.log('[ConnectionPool] Shutting down all connection pools...');
    
    for (const [poolName, pool] of this.pools.entries()) {
      for (const connection of pool) {
        try {
          // If the client has a close method, call it
          if (connection.client && typeof connection.client.close === 'function') {
            await connection.client.close();
          }
        } catch (error) {
          console.warn(`[ConnectionPool] Error closing connection ${connection.id}:`, error);
        }
      }
    }
    
    this.pools.clear();
    console.log('[ConnectionPool] All pools closed');
  }
}

// Utility for database operations with connection pooling
export class OptimizedDatabaseClient {
  static async executeWithPool<T>(
    operation: (client: any) => Promise<T>,
    supabaseFactory: () => any,
    poolName = 'default'
  ): Promise<T> {
    return ConnectionPoolManager.withConnection(
      poolName,
      supabaseFactory,
      operation
    );
  }

  // Batch operations for better performance
  static async executeBatch<T>(
    operations: Array<(client: any) => Promise<T>>,
    supabaseFactory: () => any,
    poolName = 'batch',
    concurrency = 3
  ): Promise<T[]> {
    const results: T[] = [];
    
    // Execute operations in controlled batches
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      
      const batchResults = await Promise.all(
        batch.map(operation => 
          this.executeWithPool(operation, supabaseFactory, poolName)
        )
      );
      
      results.push(...batchResults);
    }
    
    return results;
  }
}