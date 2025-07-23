
interface TimeoutConfig {
  component: string;
  timeout: number;
  onTimeout: () => void;
}

export class LoadingTimeoutService {
  private static timeouts = new Map<string, NodeJS.Timeout>();
  
  static startTimeout(config: TimeoutConfig): void {
    const { component, timeout, onTimeout } = config;
    
    // Clear existing timeout if any
    this.clearTimeout(component);
    
    console.log(`[LoadingTimeoutService] Starting ${timeout}ms timeout for ${component}`);
    
    const timeoutId = setTimeout(() => {
      console.log(`[LoadingTimeoutService] Timeout triggered for ${component}`);
      onTimeout();
    }, timeout);
    
    this.timeouts.set(component, timeoutId);
  }
  
  static clearTimeout(component: string): void {
    const timeoutId = this.timeouts.get(component);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(component);
      console.log(`[LoadingTimeoutService] Cleared timeout for ${component}`);
    }
  }
  
  static clearAllTimeouts(): void {
    this.timeouts.forEach((timeoutId, component) => {
      clearTimeout(timeoutId);
      console.log(`[LoadingTimeoutService] Cleared timeout for ${component}`);
    });
    this.timeouts.clear();
  }
}
