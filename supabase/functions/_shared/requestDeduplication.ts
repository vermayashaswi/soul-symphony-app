/**
 * Request-level deduplication utilities for edge functions
 * Prevents duplicate message processing and ensures single response guarantee
 */

export interface ProcessingLock {
  userId: string;
  messageHash: string;
  timestamp: number;
  correlationId: string;
  isActive: boolean;
}

// In-memory locks store (per function instance)
const activeLocks = new Map<string, ProcessingLock>();
const lockTimeout = 30000; // 30 seconds

/**
 * Creates a deterministic hash for message deduplication
 */
export function createMessageHash(message: string, userId: string, threadId?: string): string {
  const content = `${userId}:${threadId || 'no-thread'}:${message.trim().toLowerCase()}`;
  return btoa(content).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
}

/**
 * Acquires a processing lock for request deduplication
 */
export async function acquireProcessingLock(
  supabaseClient: any,
  message: string, 
  userId: string, 
  threadId?: string,
  correlationId?: string
): Promise<{ acquired: boolean; lockKey: string; existingCorrelationId?: string }> {
  const messageHash = createMessageHash(message, userId, threadId);
  const lockKey = `${userId}:${messageHash}`;
  
  console.log(`[REQUEST DEDUP] Attempting to acquire lock: ${lockKey}`);
  
  // Check in-memory locks first (fast path)
  const existingLock = activeLocks.get(lockKey);
  if (existingLock && existingLock.isActive && (Date.now() - existingLock.timestamp) < lockTimeout) {
    console.log(`[REQUEST DEDUP] Request already being processed, correlation: ${existingLock.correlationId}`);
    return { 
      acquired: false, 
      lockKey, 
      existingCorrelationId: existingLock.correlationId 
    };
  }
  
  // Try database-level advisory lock for distributed systems
  try {
    const lockId = hashStringToInt(lockKey);
    console.log(`[REQUEST DEDUP] Attempting advisory lock with ID: ${lockId}`);
    
    const { data, error } = await supabaseClient.rpc('pg_try_advisory_lock', {
      key: lockId
    });
    
    if (error) {
      console.warn(`[REQUEST DEDUP] Advisory lock error (continuing anyway):`, error);
      // Continue with in-memory lock as fallback
    } else if (data === false) {
      console.log(`[REQUEST DEDUP] Advisory lock already held for: ${lockKey}`);
      return { acquired: false, lockKey };
    }
  } catch (error) {
    console.warn(`[REQUEST DEDUP] Advisory lock exception (continuing):`, error);
  }
  
  // Create the lock
  const lock: ProcessingLock = {
    userId,
    messageHash,
    timestamp: Date.now(),
    correlationId: correlationId || `req_${Date.now()}_${crypto.randomUUID().split('-')[0]}`,
    isActive: true
  };
  
  activeLocks.set(lockKey, lock);
  console.log(`[REQUEST DEDUP] Lock acquired: ${lockKey}, correlation: ${lock.correlationId}`);
  
  return { acquired: true, lockKey };
}

/**
 * Releases a processing lock
 */
export async function releaseProcessingLock(
  supabaseClient: any,
  lockKey: string
): Promise<void> {
  console.log(`[REQUEST DEDUP] Releasing lock: ${lockKey}`);
  
  // Remove from in-memory locks
  const lock = activeLocks.get(lockKey);
  if (lock) {
    lock.isActive = false;
    activeLocks.delete(lockKey);
  }
  
  // Release advisory lock
  try {
    const lockId = hashStringToInt(lockKey);
    await supabaseClient.rpc('pg_advisory_unlock', {
      key: lockId
    });
  } catch (error) {
    console.warn(`[REQUEST DEDUP] Error releasing advisory lock:`, error);
  }
}

/**
 * Cleans up expired locks
 */
export function cleanupExpiredLocks(): void {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, lock] of activeLocks.entries()) {
    if (!lock.isActive || (now - lock.timestamp) > lockTimeout) {
      activeLocks.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[REQUEST DEDUP] Cleaned up ${cleaned} expired locks`);
  }
}

/**
 * Converts string to integer for PostgreSQL advisory locks
 */
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Ensures deterministic classification for the same message
 */
export function createClassificationCache(): Map<string, any> {
  return new Map();
}

const classificationCache = createClassificationCache();

export function getCachedClassification(message: string, userId: string): any | null {
  const cacheKey = createMessageHash(message, userId);
  return classificationCache.get(cacheKey) || null;
}

export function setCachedClassification(message: string, userId: string, classification: any): void {
  const cacheKey = createMessageHash(message, userId);
  classificationCache.set(cacheKey, classification);
  
  // Cleanup old cache entries (keep last 100)
  if (classificationCache.size > 100) {
    const entries = Array.from(classificationCache.entries());
    const toDelete = entries.slice(0, entries.length - 100);
    toDelete.forEach(([key]) => classificationCache.delete(key));
  }
}

// Cleanup expired locks every 5 minutes
setInterval(cleanupExpiredLocks, 5 * 60 * 1000);
