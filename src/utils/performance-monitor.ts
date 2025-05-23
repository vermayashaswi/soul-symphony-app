interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  error?: string;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  
  startOperation(operationId: string, operationName: string, metadata?: Record<string, any>): void {
    this.metrics.set(operationId, {
      operation: operationName,
      startTime: Date.now(),
      status: 'pending',
      metadata
    });
    
    console.log(`[Performance] Started: ${operationName} (${operationId})`, metadata);
  }
  
  endOperation(operationId: string, status: 'success' | 'error', error?: string, result?: any): void {
    const metric = this.metrics.get(operationId);
    if (!metric) {
      console.warn(`[Performance] Operation not found: ${operationId}`);
      return;
    }
    
    const endTime = Date.now();
    const duration = endTime - metric.startTime;
    
    metric.endTime = endTime;
    metric.duration = duration;
    metric.status = status;
    if (error) metric.error = error;
    if (result) metric.metadata = { ...metric.metadata, result };
    
    const statusIcon = status === 'success' ? '✅' : '❌';
    console.log(`[Performance] ${statusIcon} ${metric.operation}: ${duration}ms (${operationId})`);
    
    // Enhanced performance categorization
    if (duration > 10000) {
      console.error(`[Performance] CRITICAL SLOW: ${metric.operation} took ${duration}ms - NEEDS IMMEDIATE ATTENTION`);
    } else if (duration > 6000) {
      console.warn(`[Performance] SLOW OPERATION: ${metric.operation} took ${duration}ms - Consider optimization`);
    } else if (duration > 3000) {
      console.log(`[Performance] MODERATE: ${metric.operation} took ${duration}ms - Within acceptable range`);
    } else if (duration < 2000) {
      console.log(`[Performance] FAST: ${metric.operation} completed in ${duration}ms - Excellent performance`);
    }
    
    // Track specific operation types with enhanced categories
    if (metric.operation.includes('search') || metric.operation.includes('vector') || metric.operation.includes('sql')) {
      const searchType = metric.operation.includes('vector') ? 'Vector' : 
                        metric.operation.includes('sql') ? 'SQL' : 'General';
      console.log(`[Performance] ${searchType} Search: ${duration}ms for ${metric.operation}`);
      
      if (duration > 4000) {
        console.warn(`[Performance] ${searchType} search is slow - consider threshold optimization`);
      }
    } else if (metric.operation.includes('GPT') || metric.operation.includes('OpenAI') || metric.operation.includes('embedding')) {
      const aiType = metric.operation.includes('embedding') ? 'Embedding' : 'GPT';
      console.log(`[Performance] ${aiType} Performance: ${duration}ms for ${metric.operation}`);
      
      if (duration > 8000) {
        console.warn(`[Performance] ${aiType} call is slow - consider timeout reduction`);
      }
    } else if (metric.operation.includes('query-planning')) {
      console.log(`[Performance] Query Planning: ${duration}ms for ${metric.operation}`);
      
      if (duration > 5000) {
        console.warn(`[Performance] Query planning is slow - consider prompt optimization`);
      }
    }
  }
  
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }
  
  clearMetrics(): void {
    this.metrics.clear();
  }
  
  getAverageTime(operationName: string): number {
    const operations = Array.from(this.metrics.values())
      .filter(m => m.operation === operationName && m.duration !== undefined);
    
    if (operations.length === 0) return 0;
    
    const totalTime = operations.reduce((sum, op) => sum + (op.duration || 0), 0);
    return totalTime / operations.length;
  }
  
  getSlowOperations(threshold: number = 4000): PerformanceMetric[] {
    return Array.from(this.metrics.values())
      .filter(m => m.duration && m.duration > threshold)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));
  }
  
  logSummary(): void {
    const metrics = this.getMetrics();
    const completed = metrics.filter(m => m.status !== 'pending');
    const successful = completed.filter(m => m.status === 'success');
    const failed = completed.filter(m => m.status === 'error');
    
    if (completed.length === 0) {
      console.log('[Performance] No completed operations to summarize');
      return;
    }
    
    const avgDuration = completed.reduce((sum, m) => sum + (m.duration || 0), 0) / completed.length;
    const slowOps = this.getSlowOperations();
    const fastOps = completed.filter(m => m.duration && m.duration < 2000);
    
    console.log(`[Performance] Summary:
      - Total operations: ${metrics.length}
      - Completed: ${completed.length} (${successful.length} success, ${failed.length} failed)
      - Average duration: ${Math.round(avgDuration)}ms
      - Fast operations (<2s): ${fastOps.length}
      - Slow operations (>4s): ${slowOps.length}
      ${slowOps.length > 0 ? `- Slowest: ${slowOps[0].operation} (${slowOps[0].duration}ms)` : ''}
      ${avgDuration > 5000 ? '⚠️  Overall performance needs optimization' : avgDuration < 3000 ? '✅ Good overall performance' : '📊 Acceptable performance'}`);
  }
  
  // New method to track RAG pipeline performance with sub-questions
  trackRAGPipeline(queryType: string, subQuestionCount: number, totalResults: number, totalDuration: number): void {
    const pipelineId = `rag-pipeline-${Date.now()}`;
    
    console.log(`[Performance] Intelligent RAG Pipeline Complete:
      - Query Type: ${queryType}
      - Sub-Questions: ${subQuestionCount}
      - Total Results: ${totalResults}
      - Total Duration: ${totalDuration}ms
      - Avg per Sub-Question: ${subQuestionCount > 0 ? Math.round(totalDuration / subQuestionCount) : 0}ms
      - Performance: ${totalDuration < 6000 ? '✅ Fast' : totalDuration < 10000 ? '⚠️ Moderate' : '❌ Slow'}`);
    
    // Store pipeline metrics
    this.metrics.set(pipelineId, {
      operation: `intelligent-rag-pipeline-${queryType}`,
      startTime: Date.now() - totalDuration,
      endTime: Date.now(),
      duration: totalDuration,
      status: totalResults > 0 ? 'success' : 'error',
      metadata: {
        queryType,
        subQuestionCount,
        totalResults,
        avgPerSubQuestion: subQuestionCount > 0 ? Math.round(totalDuration / subQuestionCount) : 0,
        performance: totalDuration < 6000 ? 'fast' : totalDuration < 10000 ? 'moderate' : 'slow'
      }
    });
  }
  
  // New method to track sub-question execution
  trackSubQuestionExecution(subQuestionIndex: number, question: string, resultCount: number, duration: number): void {
    const subQuestionId = `sub-question-${Date.now()}-${subQuestionIndex}`;
    
    console.log(`[Performance] Sub-Question ${subQuestionIndex + 1} Complete:
      - Question: "${question.substring(0, 50)}..."
      - Results: ${resultCount}
      - Duration: ${duration}ms
      - Effectiveness: ${resultCount > 0 ? '✅ Effective' : '❌ No Results'}`);
    
    this.metrics.set(subQuestionId, {
      operation: `sub-question-execution`,
      startTime: Date.now() - duration,
      endTime: Date.now(),
      duration: duration,
      status: resultCount > 0 ? 'success' : 'error',
      metadata: {
        subQuestionIndex,
        question: question.substring(0, 100),
        resultCount,
        effectiveness: resultCount > 0 ? 'effective' : 'ineffective'
      }
    });
  }
  
  // Enhanced monitoring for emergency fixes
  trackEmergencyFix(
    fixType: 'progressive_threshold' | 'keyword_fallback' | 'retry_logic',
    queryType: string,
    resultCount: number,
    duration: number,
    thresholdUsed?: number
  ): void {
    const fixId = `emergency-fix-${Date.now()}`;
    
    console.log(`[Performance] Emergency Fix Applied:
      - Fix Type: ${fixType}
      - Query Type: ${queryType}
      - Results Found: ${resultCount}
      - Duration: ${duration}ms
      ${thresholdUsed ? `- Final Threshold: ${thresholdUsed}` : ''}
      - Effectiveness: ${resultCount > 0 ? '✅ Successful' : '❌ Failed'}`);
    
    this.metrics.set(fixId, {
      operation: `emergency-fix-${fixType}`,
      startTime: Date.now() - duration,
      endTime: Date.now(),
      duration: duration,
      status: resultCount > 0 ? 'success' : 'error',
      metadata: {
        fixType,
        queryType,
        resultCount,
        thresholdUsed,
        effectiveness: resultCount > 0 ? 'successful' : 'failed'
      }
    });
  }
  
  // Track progressive threshold attempts
  trackProgressiveThreshold(
    thresholds: number[],
    successfulThreshold: number | null,
    queryType: string,
    totalDuration: number
  ): void {
    console.log(`[Performance] Progressive Threshold Analysis:
      - Thresholds Tried: ${thresholds.join(', ')}
      - Successful Threshold: ${successfulThreshold || 'None'}
      - Query Type: ${queryType}
      - Total Duration: ${totalDuration}ms
      - Success Rate: ${successfulThreshold ? 'Success' : 'Failed'}`);
    
    if (successfulThreshold && successfulThreshold <= 0.05) {
      console.log(`[Performance] 💡 Ultra-low threshold (${successfulThreshold}) was needed - query may need semantic optimization`);
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Enhanced monitoring for async operations with better error handling
export async function withPerformanceMonitoring<T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const operationId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  performanceMonitor.startOperation(operationId, operationName, metadata);
  
  try {
    const result = await operation();
    performanceMonitor.endOperation(operationId, 'success', undefined, { 
      resultType: typeof result,
      resultSize: Array.isArray(result) ? result.length : 'N/A'
    });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    performanceMonitor.endOperation(operationId, 'error', errorMessage);
    throw error;
  }
}

// Enhanced monitoring for chat operations with RAG pipeline tracking
export function monitorChatOperation<T>(
  operation: () => Promise<T>,
  operationType: 'query-planning' | 'vector-search' | 'sql-search' | 'response-generation' | 'embedding' | 'rag-pipeline',
  queryInfo?: { message: string; userId: string; strategy?: string; threshold?: number }
): Promise<T> {
  return withPerformanceMonitoring(
    `chat-${operationType}`,
    operation,
    {
      queryLength: queryInfo?.message?.length,
      userId: queryInfo?.userId?.substring(0, 8) + '...',
      strategy: queryInfo?.strategy,
      threshold: queryInfo?.threshold
    }
  );
}

// New utility for tracking search effectiveness
export function trackSearchEffectiveness(
  searchType: 'vector' | 'sql' | 'fallback',
  threshold: number,
  resultCount: number,
  queryType: string,
  duration: number
): void {
  const effectiveness = resultCount > 0 ? 'effective' : 'ineffective';
  const speed = duration < 2000 ? 'fast' : duration < 4000 ? 'moderate' : 'slow';
  
  console.log(`[Performance] Search Effectiveness:
    - Type: ${searchType}
    - Query Type: ${queryType}
    - Threshold: ${threshold}
    - Results: ${resultCount}
    - Duration: ${duration}ms
    - Effectiveness: ${effectiveness}
    - Speed: ${speed}
    ${resultCount === 0 && threshold > 0.2 ? '💡 Consider lowering threshold' : ''}
    ${duration > 4000 ? '💡 Consider optimizing search parameters' : ''}`);
}

// Enhanced monitoring for intelligent sub-query operations
export function monitorSubQueryExecution<T>(
  operation: () => Promise<T>,
  subQuestionIndex: number,
  question: string
): Promise<T> {
  return withPerformanceMonitoring(
    `sub-question-${subQuestionIndex}`,
    operation,
    {
      subQuestionIndex,
      questionPreview: question.substring(0, 50),
      operationType: 'intelligent-sub-query'
    }
  );
}

// Enhanced utility for tracking intelligent search effectiveness
export function trackIntelligentSearchEffectiveness(
  subQuestionCount: number,
  totalResults: number,
  duration: number,
  queryType: string
): void {
  const avgResultsPerSubQuestion = subQuestionCount > 0 ? totalResults / subQuestionCount : 0;
  const avgTimePerSubQuestion = subQuestionCount > 0 ? duration / subQuestionCount : duration;
  
  console.log(`[Performance] Intelligent Search Summary:
    - Sub-Questions: ${subQuestionCount}
    - Total Results: ${totalResults}
    - Avg Results/Sub-Question: ${avgResultsPerSubQuestion.toFixed(1)}
    - Avg Time/Sub-Question: ${avgTimePerSubQuestion.toFixed(0)}ms
    - Overall Effectiveness: ${totalResults > 0 ? 'effective' : 'ineffective'}
    - Query Type: ${queryType}
    ${totalResults === 0 ? '💡 Consider adjusting sub-question strategies' : ''}
    ${duration > 8000 ? '💡 Consider optimizing parallel execution' : ''}`);
}
