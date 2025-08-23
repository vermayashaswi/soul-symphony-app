/**
 * Thread Safety Manager
 * Ensures operations are only performed for the correct thread context
 */

interface ThreadOperation {
  threadId: string;
  operationType: string;
  timestamp: number;
  abortController?: AbortController;
}

class ThreadSafetyManager {
  private activeOperations = new Map<string, ThreadOperation[]>();
  private currentActiveThread: string | null = null;

  /**
   * Set the currently active thread
   */
  setActiveThread(threadId: string | null) {
    console.log(`[ThreadSafetyManager] Active thread changed: ${this.currentActiveThread} -> ${threadId}`);
    
    // Abort operations for non-active threads
    if (this.currentActiveThread && this.currentActiveThread !== threadId) {
      this.abortThreadOperations(this.currentActiveThread);
    }
    
    this.currentActiveThread = threadId;
  }

  /**
   * Register a new operation for a thread
   */
  registerOperation(threadId: string, operationType: string, abortController?: AbortController): string {
    const operationId = `${threadId}-${operationType}-${Date.now()}`;
    
    if (!this.activeOperations.has(threadId)) {
      this.activeOperations.set(threadId, []);
    }
    
    const operation: ThreadOperation = {
      threadId,
      operationType,
      timestamp: Date.now(),
      abortController
    };
    
    this.activeOperations.get(threadId)!.push(operation);
    
    console.log(`[ThreadSafetyManager] Registered operation: ${operationId}`);
    return operationId;
  }

  /**
   * Check if an operation should proceed (thread is still active)
   */
  shouldProceed(threadId: string, operationType: string): boolean {
    const isActive = this.currentActiveThread === threadId;
    
    if (!isActive) {
      console.warn(`[ThreadSafetyManager] Operation ${operationType} cancelled for inactive thread: ${threadId}`);
    }
    
    return isActive;
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
  completeOperation(threadId: string, operationType: string) {
    const operations = this.activeOperations.get(threadId);
    if (!operations) return;
    
    const index = operations.findIndex(op => op.operationType === operationType);
    if (index !== -1) {
      operations.splice(index, 1);
      console.log(`[ThreadSafetyManager] Completed operation: ${operationType} for thread: ${threadId}`);
    }
    
    if (operations.length === 0) {
      this.activeOperations.delete(threadId);
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
    return operations ? operations.length > 0 : false;
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

// Helper hook for React components
export const useThreadSafety = (threadId: string | null) => {
  const registerOperation = (operationType: string, abortController?: AbortController) => {
    return threadId ? threadSafetyManager.registerOperation(threadId, operationType, abortController) : null;
  };

  const shouldProceed = (operationType: string) => {
    return threadId ? threadSafetyManager.shouldProceed(threadId, operationType) : false;
  };

  const completeOperation = (operationType: string) => {
    if (threadId) {
      threadSafetyManager.completeOperation(threadId, operationType);
    }
  };

  return {
    registerOperation,
    shouldProceed,
    completeOperation,
    isActiveThread: threadSafetyManager.getActiveThread() === threadId
  };
};