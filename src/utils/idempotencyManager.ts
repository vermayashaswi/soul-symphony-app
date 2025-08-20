/**
 * Idempotency Manager
 * Ensures message uniqueness and prevents duplicates across threads
 */

interface IdempotencyRecord {
  key: string;
  threadId: string;
  messageId: string;
  timestamp: number;
  content: string;
}

class IdempotencyManager {
  private recentKeys = new Map<string, IdempotencyRecord>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Clean up old keys every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldKeys();
    }, 5 * 60 * 1000);
  }

  /**
   * Generate idempotency key for a message
   */
  async generateIdempotencyKey(threadId: string, content: string, sender: 'user' | 'assistant', timestamp?: number): Promise<string> {
    const messageTimestamp = timestamp || Date.now();
    const keySource = `${threadId}:${sender}:${content}:${Math.floor(messageTimestamp / 1000)}`;
    
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(keySource);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.slice(0, 32); // Use first 32 characters
    } catch (error) {
      console.warn('[IdempotencyManager] Crypto API not available, using fallback hash');
      // Fallback for environments without crypto.subtle
      return this.simpleHash(keySource).slice(0, 32);
    }
  }

  /**
   * Simple hash function fallback
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Check if an idempotency key is already used
   */
  isKeyUsed(key: string): boolean {
    return this.recentKeys.has(key);
  }

  /**
   * Register a new idempotency key
   */
  registerKey(key: string, threadId: string, messageId: string, content: string): void {
    this.recentKeys.set(key, {
      key,
      threadId,
      messageId,
      timestamp: Date.now(),
      content: content.slice(0, 100) // Store truncated content for debugging
    });
  }

  /**
   * Get duplicate message info if key exists
   */
  getDuplicateInfo(key: string): IdempotencyRecord | null {
    return this.recentKeys.get(key) || null;
  }

  /**
   * Clean up keys older than 1 hour
   */
  private cleanupOldKeys(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleanedCount = 0;
    
    for (const [key, record] of this.recentKeys.entries()) {
      if (record.timestamp < oneHourAgo) {
        this.recentKeys.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[IdempotencyManager] Cleaned up ${cleanedCount} old idempotency keys`);
    }
  }

  /**
   * Validate message for thread consistency
   */
  validateMessageForThread(threadId: string, content: string, sender: 'user' | 'assistant'): { valid: boolean; reason?: string } {
    // Check for obvious duplicates in recent keys
    for (const record of this.recentKeys.values()) {
      if (record.threadId === threadId && record.content === content.slice(0, 100)) {
        const timeDiff = Date.now() - record.timestamp;
        if (timeDiff < 5000) { // 5 seconds
          return { 
            valid: false, 
            reason: `Duplicate message detected within 5 seconds for thread ${threadId}` 
          };
        }
      }
    }
    
    return { valid: true };
  }

  /**
   * Generate correlation ID for request tracking
   */
  generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Cleanup on shutdown
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.recentKeys.clear();
  }
}

// Export singleton instance
export const idempotencyManager = new IdempotencyManager();

// Helper function for React components
export const useIdempotency = () => {
  return {
    generateKey: idempotencyManager.generateIdempotencyKey.bind(idempotencyManager),
    isKeyUsed: idempotencyManager.isKeyUsed.bind(idempotencyManager),
    registerKey: idempotencyManager.registerKey.bind(idempotencyManager),
    validateMessage: idempotencyManager.validateMessageForThread.bind(idempotencyManager),
    generateCorrelationId: idempotencyManager.generateCorrelationId.bind(idempotencyManager)
  };
};