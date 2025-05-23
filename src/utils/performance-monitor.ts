
interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  
  startOperation(operationId: string, operationName: string): void {
    this.metrics.set(operationId, {
      operation: operationName,
      startTime: Date.now(),
      status: 'pending'
    });
    
    console.log(`[Performance] Started: ${operationName} (${operationId})`);
  }
  
  endOperation(operationId: string, status: 'success' | 'error', error?: string): void {
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
    
    const statusIcon = status === 'success' ? '✅' : '❌';
    console.log(`[Performance] ${statusIcon} ${metric.operation}: ${duration}ms (${operationId})`);
    
    // Log warning for slow operations
    if (duration > 10000) {
      console.warn(`[Performance] SLOW OPERATION: ${metric.operation} took ${duration}ms`);
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
}

export const performanceMonitor = new PerformanceMonitor();

// Helper function to wrap async operations with performance monitoring
export async function withPerformanceMonitoring<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const operationId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  performanceMonitor.startOperation(operationId, operationName);
  
  try {
    const result = await operation();
    performanceMonitor.endOperation(operationId, 'success');
    return result;
  } catch (error) {
    performanceMonitor.endOperation(operationId, 'error', error.message);
    throw error;
  }
}
