/**
 * Enhanced Thread Safety Manager
 * Ensures operations are only performed for the correct thread context
 * Prevents cross-thread message contamination and race conditions
 */

interface ThreadOperation {
  threadId: string;
  operationType: string;
  timestamp: number;
  requestId: string;
  abortController?: AbortController;
}

interface ThreadContext {
  threadId: string;
  isActive: boolean;
  lastActivity: number;
  activeRequestId: string | null;
  pendingOperations: Set<string>;
}

class ThreadSafetyManager {
  private activeOperations = new Map<string, ThreadOperation[]>();
  private threadContexts = new Map<string, ThreadContext>();
  private currentActiveThread: string | null = null;

  /**
   * Set the currently active thread with enhanced context management
   */
  setActiveThread(threadId: string | null) {
    console.log(`[ThreadSafetyManager] Active thread changed: ${this.currentActiveThread} -> ${threadId}`);
    
    // Mark previous thread as inactive and abort its operations
    if (this.currentActiveThread && this.currentActiveThread !== threadId) {
      this.markThreadInactive(this.currentActiveThread);
      this.abortThreadOperations(this.currentActiveThread);
    }
    
    this.currentActiveThread = threadId;
    
    // Initialize or activate the new thread context
    if (threadId) {
      this.ensureThreadContext(threadId);
      const context = this.threadContexts.get(threadId)!;
      context.isActive = true;
      context.lastActivity = Date.now();
    }
  }

  /**
   * Ensure thread context exists and is properly initialized
   */
  private ensureThreadContext(threadId: string): ThreadContext {
    if (!this.threadContexts.has(threadId)) {
      this.threadContexts.set(threadId, {
        threadId,
        isActive: false,
        lastActivity: Date.now(),
        activeRequestId: null,
        pendingOperations: new Set()
      });
    }
    return this.threadContexts.get(threadId)!;
  }

  /**
   * Mark a thread as inactive and clear its context
   */
  private markThreadInactive(threadId: string) {
    const context = this.threadContexts.get(threadId);
    if (context) {
      context.isActive = false;
      context.activeRequestId = null;
      context.pendingOperations.clear();
    }
  }

  /**
   * Register a new operation for a thread with enhanced tracking
   */
  registerOperation(threadId: string, operationType: string, abortController?: AbortController): string {
    const requestId = this.generateRequestId();
    const operationId = `${threadId}-${operationType}-${Date.now()}-${requestId}`;
    
    // Ensure thread context exists
    const context = this.ensureThreadContext(threadId);
    context.lastActivity = Date.now();
    context.pendingOperations.add(operationId);
    
    if (!this.activeOperations.has(threadId)) {
      this.activeOperations.set(threadId, []);
    }
    
    const operation: ThreadOperation = {
      threadId,
      operationType,
      timestamp: Date.now(),
      requestId,
      abortController
    };
    
    this.activeOperations.get(threadId)!.push(operation);
    
    console.log(`[ThreadSafetyManager] Registered operation: ${operationId} for thread: ${threadId}`);
    return operationId;
  }

  /**
   * Set active request ID for a thread to prevent stale responses
   */
  setActiveRequestId(threadId: string, requestId: string | null) {
    const context = this.ensureThreadContext(threadId);
    context.activeRequestId = requestId;
    console.log(`[ThreadSafetyManager] Set active request ID for thread ${threadId}: ${requestId}`);
  }

  /**
   * Check if a request ID is still active for the thread
   */
  isRequestActive(threadId: string, requestId: string): boolean {
    const context = this.threadContexts.get(threadId);
    if (!context || !context.isActive) {
      console.warn(`[ThreadSafetyManager] Thread ${threadId} is not active, rejecting request ${requestId}`);
      return false;
    }
    
    const isActive = context.activeRequestId === requestId;
    if (!isActive) {
      console.warn(`[ThreadSafetyManager] Request ${requestId} is stale for thread ${threadId}. Active: ${context.activeRequestId}`);
    }
    
    return isActive;
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Check if an operation should proceed (thread is still active and request is valid)
   */
  shouldProceed(threadId: string, operationType: string, requestId?: string): boolean {
    const isActiveThread = this.currentActiveThread === threadId;
    const context = this.threadContexts.get(threadId);
    
    if (!isActiveThread) {
      console.warn(`[ThreadSafetyManager] Operation ${operationType} cancelled for inactive thread: ${threadId}`);
      return false;
    }
    
    if (!context?.isActive) {
      console.warn(`[ThreadSafetyManager] Operation ${operationType} cancelled - thread context inactive: ${threadId}`);
      return false;
    }
    
    // If requestId is provided, validate it's still the active request
    if (requestId && context.activeRequestId && context.activeRequestId !== requestId) {
      console.warn(`[ThreadSafetyManager] Operation ${operationType} cancelled - stale request ${requestId} for thread: ${threadId}`);
      return false;
    }
    
    return true;
  }

  /**
   * Abort all operations for a specific thread
   */
  abortThreadOperations(threadId: string) {
    const operations = this.activeOperations.get(threadId) || [];
    
    console.log(`[ThreadSafetyManager] Aborting ${operations.length} operations for thread: ${threadId}`);
    
    operations.forEach(operation => {
      if (operation.abortController) {
        operation.abortController.abort();
      }
    });
    
    this.activeOperations.delete(threadId);
  }

  /**
   * Complete an operation (remove from tracking)
   */
  completeOperation(threadId: string, operationType: string, operationId?: string) {
    const operations = this.activeOperations.get(threadId);
    const context = this.threadContexts.get(threadId);
    
    if (operations) {
      const index = operations.findIndex(op => op.operationType === operationType);
      if (index !== -1) {
        operations.splice(index, 1);
        console.log(`[ThreadSafetyManager] Completed operation: ${operationType} for thread: ${threadId}`);
      }
      
      if (operations.length === 0) {
        this.activeOperations.delete(threadId);
      }
    }
    
    if (context && operationId) {
      context.pendingOperations.delete(operationId);
    }
  }

  /**
   * Get current active thread
   */
  getActiveThread(): string | null {
    return this.currentActiveThread;
  }

  /**
   * Check if a thread has active operations
   */
  hasActiveOperations(threadId: string): boolean {
    const operations = this.activeOperations.get(threadId);
    const context = this.threadContexts.get(threadId);
    return (operations ? operations.length > 0 : false) || (context ? context.pendingOperations.size > 0 : false);
  }

  /**
   * Validate thread ownership and context before processing
   */
  validateThreadContext(threadId: string, requestId?: string): { valid: boolean; reason?: string } {
    if (!threadId) {
      return { valid: false, reason: 'Missing thread ID' };
    }
    
    if (this.currentActiveThread !== threadId) {
      return { valid: false, reason: `Thread ${threadId} is not the active thread` };
    }
    
    const context = this.threadContexts.get(threadId);
    if (!context?.isActive) {
      return { valid: false, reason: `Thread ${threadId} context is not active` };
    }
    
    if (requestId && context.activeRequestId && context.activeRequestId !== requestId) {
      return { valid: false, reason: `Request ${requestId} is stale for thread ${threadId}` };
    }
    
    return { valid: true };
  }

  /**
   * Clean up operations older than specified age (in milliseconds)
   */
  cleanupOldOperations(maxAge: number = 60000) {
    const cutoffTime = Date.now() - maxAge;
    
    this.activeOperations.forEach((operations, threadId) => {
      const validOperations = operations.filter(op => op.timestamp > cutoffTime);
      
      if (validOperations.length !== operations.length) {
        console.log(`[ThreadSafetyManager] Cleaned up ${operations.length - validOperations.length} old operations for thread: ${threadId}`);
        
        if (validOperations.length === 0) {
          this.activeOperations.delete(threadId);
        } else {
          this.activeOperations.set(threadId, validOperations);
        }
      }
    });
  }
}

// Export singleton instance
export const threadSafetyManager = new ThreadSafetyManager();

// Helper hook for React components with enhanced thread safety
export const useThreadSafety = (threadId: string | null) => {
  const registerOperation = (operationType: string, abortController?: AbortController) => {
    return threadId ? threadSafetyManager.registerOperation(threadId, operationType, abortController) : null;
  };

  const shouldProceed = (operationType: string, requestId?: string) => {
    return threadId ? threadSafetyManager.shouldProceed(threadId, operationType, requestId) : false;
  };

  const completeOperation = (operationType: string, operationId?: string) => {
    if (threadId) {
      threadSafetyManager.completeOperation(threadId, operationType, operationId);
    }
  };

  const setActiveRequestId = (requestId: string | null) => {
    if (threadId) {
      threadSafetyManager.setActiveRequestId(threadId, requestId);
    }
  };

  const isRequestActive = (requestId: string) => {
    return threadId ? threadSafetyManager.isRequestActive(threadId, requestId) : false;
  };

  const validateContext = (requestId?: string) => {
    return threadId ? threadSafetyManager.validateThreadContext(threadId, requestId) : { valid: false, reason: 'No thread ID' };
  };

  return {
    registerOperation,
    shouldProceed,
    completeOperation,
    setActiveRequestId,
    isRequestActive,
    validateContext,
    isActiveThread: threadSafetyManager.getActiveThread() === threadId
  };
};