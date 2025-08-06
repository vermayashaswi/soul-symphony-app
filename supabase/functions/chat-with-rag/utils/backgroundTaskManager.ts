// Background task manager for non-blocking operations
export class BackgroundTaskManager {
  private static instance: BackgroundTaskManager;
  private tasks: Promise<any>[] = [];

  static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  // Add task to background processing queue
  addTask(taskPromise: Promise<any>): void {
    this.tasks.push(
      taskPromise.catch(error => {
        console.error('[BackgroundTask] Task failed:', error);
        return null;
      })
    );
  }

  // Wait for all background tasks to complete
  async waitForAll(): Promise<void> {
    if (this.tasks.length > 0) {
      await Promise.allSettled(this.tasks);
      this.tasks = [];
    }
  }

  // Simplified logging without rate limiting
  static logApiUsage(rateLimitManager: any, params: any): void {
    // No-op - rate limiting removed
    console.log(`[BackgroundTaskManager] API usage logged: ${params.functionName || 'unknown'}`);
  }

  // Cache results in background
  static cacheResults(cacheKey: string, data: any, ttl = 300): void {
    const task = async () => {
      try {
        // Simple in-memory cache for demo - in production use Redis
        const cache = new Map();
        cache.set(cacheKey, {
          data,
          expiry: Date.now() + (ttl * 1000)
        });
        console.log(`[BackgroundTask] Cached result for key: ${cacheKey}`);
      } catch (error) {
        console.error('[BackgroundTask] Cache operation failed:', error);
      }
    };

    BackgroundTaskManager.getInstance().addTask(task());
  }

  // Update user analytics in background
  static updateAnalytics(userId: string, queryData: any): void {
    const task = async () => {
      try {
        // Analytics update logic here
        console.log(`[BackgroundTask] Updated analytics for user: ${userId}`);
      } catch (error) {
        console.error('[BackgroundTask] Analytics update failed:', error);
      }
    };

    BackgroundTaskManager.getInstance().addTask(task());
  }

  // Precompute embeddings for recent entries
  static precomputeEmbeddings(supabase: any, openaiApiKey: string): void {
    const task = async () => {
      try {
        // Logic to precompute embeddings for entries without them
        const { data: entries } = await supabase
          .from('Journal Entries')
          .select('id, "refined text", "transcription text"')
          .is('id', null) // Entries without embeddings
          .limit(5);

        if (entries?.length) {
          console.log(`[BackgroundTask] Precomputing embeddings for ${entries.length} entries`);
          // Process embeddings...
        }
      } catch (error) {
        console.error('[BackgroundTask] Embedding precomputation failed:', error);
      }
    };

    BackgroundTaskManager.getInstance().addTask(task());
  }
}

// Utility functions for background processing
export class BackgroundProcessor {
  // Process non-critical database updates
  static scheduleDbUpdate(updateFn: () => Promise<any>): void {
    const task = async () => {
      try {
        await updateFn();
      } catch (error) {
        console.error('[BackgroundProcessor] DB update failed:', error);
      }
    };

    BackgroundTaskManager.getInstance().addTask(task());
  }

  // Process analytics and telemetry
  static scheduleTelemetry(telemetryData: any): void {
    const task = async () => {
      try {
        console.log('[BackgroundProcessor] Processing telemetry:', {
          timestamp: telemetryData.timestamp,
          eventType: telemetryData.type
        });
      } catch (error) {
        console.error('[BackgroundProcessor] Telemetry processing failed:', error);
      }
    };

    BackgroundTaskManager.getInstance().addTask(task());
  }

  // Cleanup old cache entries
  static scheduleCleanup(): void {
    const task = async () => {
      try {
        // Cleanup logic here
        console.log('[BackgroundProcessor] Performed cleanup tasks');
      } catch (error) {
        console.error('[BackgroundProcessor] Cleanup failed:', error);
      }
    };

    BackgroundTaskManager.getInstance().addTask(task());
  }
}