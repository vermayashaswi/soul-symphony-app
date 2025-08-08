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
  
  // Optimize OpenAI API calls with intelligent model selection
  static optimizeOpenAIRequest(prompt: string, maxTokens: number = 1500, isAnalytical = false): object {
    // Trim overly long prompts
    const optimizedPrompt = prompt.length > 8000 ? 
      prompt.substring(0, 7500) + "...[content truncated for performance]" : 
      prompt;
    
    // Use faster model for simple queries, more powerful for complex analysis
    const model = isAnalytical && prompt.length > 3000 ? 'gpt-4.1-2025-04-14' : 'gpt-4.1-mini-2025-04-14';
    
    return {
      model,
      messages: [{ role: 'user', content: optimizedPrompt }],
      temperature: isAnalytical ? 0.3 : 0.7, // Lower temperature for analytical responses
      max_tokens: Math.min(maxTokens, isAnalytical ? 2000 : 1500),
      stream: false
    };
  }

  // Compress prompts by removing redundancy
  static compressPrompt(prompt: string, compressionRatio = 0.8): string {
    if (prompt.length <= 1000) return prompt;
    
    const sentences = prompt.split(/[.!?]+/);
    const targetLength = Math.floor(prompt.length * compressionRatio);
    
    // Keep most important sentences (first, last, and those with keywords)
    const keywords = ['emotion', 'feeling', 'journal', 'entry', 'analysis', 'pattern'];
    const scored = sentences.map(sentence => ({
      sentence: sentence.trim(),
      score: this.scoreSentence(sentence, keywords)
    })).filter(item => item.sentence.length > 10);
    
    scored.sort((a, b) => b.score - a.score);
    
    let compressed = '';
    let currentLength = 0;
    
    for (const item of scored) {
      if (currentLength + item.sentence.length <= targetLength) {
        compressed += item.sentence + '. ';
        currentLength += item.sentence.length;
      }
    }
    
    return compressed.trim() || prompt; // Fallback to original if compression fails
  }
  
  private static scoreSentence(sentence: string, keywords: string[]): number {
    let score = 0;
    const lowerSentence = sentence.toLowerCase();
    
    // Score based on keyword presence
    keywords.forEach(keyword => {
      if (lowerSentence.includes(keyword)) score += 2;
    });
    
    // Prefer longer, more informative sentences
    score += Math.min(sentence.length / 50, 3);
    
    // Boost sentences with emotional indicators
    if (/feel|felt|emotion|mood|happy|sad|angry|excited/i.test(sentence)) {
      score += 1;
    }
    
    return score;
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
