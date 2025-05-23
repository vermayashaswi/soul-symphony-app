
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
    
    // Log performance categories
    if (duration > 15000) {
      console.error(`[Performance] CRITICAL SLOW: ${metric.operation} took ${duration}ms`);
    } else if (duration > 8000) {
      console.warn(`[Performance] SLOW OPERATION: ${metric.operation} took ${duration}ms`);
    } else if (duration < 2000) {
      console.log(`[Performance] FAST: ${metric.operation} completed in ${duration}ms`);
    }
    
    // Track specific operation types
    if (metric.operation.includes('search')) {
      console.log(`[Performance] Search Performance: ${duration}ms for ${metric.operation}`);
    } else if (metric.operation.includes('GPT') || metric.operation.includes('OpenAI')) {
      console.log(`[Performance] AI Performance: ${duration}ms for ${metric.operation}`);
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
  
  getSlowOperations(threshold: number = 5000): PerformanceMetric[] {
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
    
    console.log(`[Performance] Summary:
      - Total operations: ${metrics.length}
      - Completed: ${completed.length} (${successful.length} success, ${failed.length} failed)
      - Average duration: ${Math.round(avgDuration)}ms
      - Slow operations (>5s): ${slowOps.length}
      ${slowOps.length > 0 ? `- Slowest: ${slowOps[0].operation} (${slowOps[0].duration}ms)` : ''}`);
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Helper function to wrap async operations with performance monitoring
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
    performanceMonitor.endOperation(operationId, 'error', error.message);
    throw error;
  }
}

// Enhanced monitoring for chat operations
export function monitorChatOperation<T>(
  operation: () => Promise<T>,
  operationType: 'query-planning' | 'vector-search' | 'sql-search' | 'response-generation' | 'embedding',
  queryInfo?: { message: string; userId: string; strategy?: string }
): Promise<T> {
  return withPerformanceMonitoring(
    `chat-${operationType}`,
    operation,
    {
      queryLength: queryInfo?.message?.length,
      userId: queryInfo?.userId?.substring(0, 8) + '...',
      strategy: queryInfo?.strategy
    }
  );
}
