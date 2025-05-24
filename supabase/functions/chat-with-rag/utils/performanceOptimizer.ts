// Performance optimization utilities
export class PerformanceOptimizer {
  private static operationTimes = new Map<string, number[]>();
  
  // Track operation performance
  static startTimer(operationName: string): string {
    const timerId = `${operationName}_${Date.now()}_${Math.random()}`;
    return timerId;
  }
  
  static endTimer(timerId: string, operationName: string): number {
    const startTime = parseInt(timerId.split('_')[1]);
    const duration = Date.now() - startTime;
    
    // Track operation times
    if (!this.operationTimes.has(operationName)) {
      this.operationTimes.set(operationName, []);
    }
    
    const times = this.operationTimes.get(operationName)!;
    times.push(duration);
    
    // Keep only last 10 measurements
    if (times.length > 10) {
      times.shift();
    }
    
    console.log(`[perf] ${operationName} completed in ${duration}ms`);
    return duration;
  }
  
  // Get average operation time
  static getAverageTime(operationName: string): number {
    const times = this.operationTimes.get(operationName);
    if (!times || times.length === 0) return 0;
    
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }
  
  // Batch database operations
  static async batchDatabaseOperations<T>(
    operations: (() => Promise<T>)[],
    batchSize: number = 3
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
    }
    
    return results;
  }
  
  // Optimize OpenAI API calls
  static optimizeOpenAIRequest(prompt: string, maxTokens: number = 1500): object {
    // Trim overly long prompts
    const optimizedPrompt = prompt.length > 8000 ? 
      prompt.substring(0, 7500) + "...[content truncated for performance]" : 
      prompt;
    
    return {
      model: 'gpt-4o-mini', // Use faster model
      messages: [{ role: 'user', content: optimizedPrompt }],
      temperature: 0.7,
      max_tokens: maxTokens,
      stream: false // We'll implement streaming later
    };
  }
  
  // Connection pool optimization
  static async withConnectionPooling<T>(
    operation: () => Promise<T>,
    retries: number = 2
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < retries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.log(`[perf] Retrying operation after ${delay}ms (attempt ${attempt + 1}/${retries + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
  
  // Memory optimization
  static cleanupLargeObjects(obj: any): void {
    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        if (obj[key] && typeof obj[key] === 'object') {
          // Clear large arrays/objects to help GC
          if (Array.isArray(obj[key]) && obj[key].length > 100) {
            obj[key] = obj[key].slice(0, 50); // Keep only first 50 items
          }
        }
      });
    }
  }
  
  // Performance report
  static getPerformanceReport(): object {
    const report: any = {
      timestamp: new Date().toISOString(),
      operations: {}
    };
    
    this.operationTimes.forEach((times, operation) => {
      const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      
      report.operations[operation] = {
        average: Math.round(avg),
        min,
        max,
        samples: times.length
      };
    });
    
    return report;
  }
}
