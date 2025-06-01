
/**
 * Application Initialization Manager
 * Coordinates app startup and ensures proper loading order
 */

interface InitializationStage {
  name: string;
  timeout: number;
  required: boolean;
  executor: () => Promise<void>;
}

interface InitializationResult {
  success: boolean;
  completedStages: string[];
  failedStages: string[];
  totalTime: number;
  errors: Error[];
}

class InitializationManager {
  private stages: InitializationStage[] = [];
  private completed = new Set<string>();
  private failed = new Set<string>();
  private isInitialized = false;
  private initPromise: Promise<InitializationResult> | null = null;

  /**
   * Register an initialization stage
   */
  registerStage(stage: InitializationStage): void {
    this.stages.push(stage);
    console.log(`InitializationManager: Registered stage "${stage.name}"`);
  }

  /**
   * Execute all initialization stages
   */
  async initialize(): Promise<InitializationResult> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.performInitialization();
    return this.initPromise;
  }

  private async performInitialization(): Promise<InitializationResult> {
    const startTime = Date.now();
    const errors: Error[] = [];

    console.log(`InitializationManager: Starting initialization with ${this.stages.length} stages`);

    for (const stage of this.stages) {
      try {
        console.log(`InitializationManager: Executing stage "${stage.name}"`);
        
        const stagePromise = stage.executor();
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Stage "${stage.name}" timeout`)), stage.timeout)
        );

        await Promise.race([stagePromise, timeoutPromise]);
        
        this.completed.add(stage.name);
        console.log(`InitializationManager: Stage "${stage.name}" completed`);

      } catch (error) {
        const stageError = error instanceof Error ? error : new Error(`Stage "${stage.name}" failed`);
        console.error(`InitializationManager: Stage "${stage.name}" failed:`, stageError);
        
        this.failed.add(stage.name);
        errors.push(stageError);

        // If this is a required stage, consider initialization failed
        if (stage.required) {
          console.error(`InitializationManager: Required stage "${stage.name}" failed, aborting`);
          break;
        }
      }
    }

    const totalTime = Date.now() - startTime;
    const success = this.failed.size === 0 || !this.stages.some(s => s.required && this.failed.has(s.name));

    this.isInitialized = true;

    const result: InitializationResult = {
      success,
      completedStages: Array.from(this.completed),
      failedStages: Array.from(this.failed),
      totalTime,
      errors
    };

    console.log('InitializationManager: Initialization complete', result);
    return result;
  }

  /**
   * Check if initialization is complete
   */
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current initialization progress
   */
  getProgress(): number {
    if (this.stages.length === 0) return 100;
    return (this.completed.size / this.stages.length) * 100;
  }

  /**
   * Reset initialization state
   */
  reset(): void {
    this.completed.clear();
    this.failed.clear();
    this.isInitialized = false;
    this.initPromise = null;
    console.log('InitializationManager: State reset');
  }
}

// Create singleton instance
export const initializationManager = new InitializationManager();

// Register default initialization stages
if (typeof window !== 'undefined') {
  // Font loading stage
  initializationManager.registerStage({
    name: 'font-loading',
    timeout: 5000,
    required: false,
    executor: async () => {
      const { fontLoadingService } = await import('./font-loading-service');
      await fontLoadingService.preloadCriticalFonts();
    }
  });

  // Viewport setup stage
  initializationManager.registerStage({
    name: 'viewport-setup',
    timeout: 1000,
    required: true,
    executor: async () => {
      // Set CSS variable for viewport height
      const setVhProperty = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      };
      
      setVhProperty();
      
      // Add resize listeners
      window.addEventListener('resize', setVhProperty);
      window.addEventListener('orientationchange', () => {
        setTimeout(setVhProperty, 100);
      });
    }
  });

  // Image preloading stage
  initializationManager.registerStage({
    name: 'image-preloading',
    timeout: 3000,
    required: false,
    executor: async () => {
      try {
        const { preloadCriticalImages } = await import('./imagePreloader');
        await preloadCriticalImages();
      } catch (error) {
        console.warn('Image preloading failed:', error);
      }
    }
  });
}
