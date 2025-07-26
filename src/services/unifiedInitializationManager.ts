import { nativeIntegrationService } from './nativeIntegrationService';
import { nativeAppInitService } from './nativeAppInitService';

interface InitializationPhase {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'timeout';
  startTime?: number;
  endTime?: number;
  error?: string;
}

interface InitializationState {
  phases: Map<string, InitializationPhase>;
  isComplete: boolean;
  hasErrors: boolean;
  totalTimeMs: number;
  isNativeApp: boolean;
}

class UnifiedInitializationManager {
  private static instance: UnifiedInitializationManager;
  private state: InitializationState;
  private listeners: Array<(state: InitializationState) => void> = [];
  private startTime: number = Date.now();

  private constructor() {
    this.state = {
      phases: new Map(),
      isComplete: false,
      hasErrors: false,
      totalTimeMs: 0,
      isNativeApp: nativeIntegrationService.isRunningNatively()
    };
    
    this.initializePhases();
  }

  public static getInstance(): UnifiedInitializationManager {
    if (!UnifiedInitializationManager.instance) {
      UnifiedInitializationManager.instance = new UnifiedInitializationManager();
    }
    return UnifiedInitializationManager.instance;
  }

  private initializePhases() {
    const phaseNames = [
      'app_init',
      'native_services',
      'auth_stabilization', 
      'session_validation',
      'capacitor_ready',
      'onboarding_check',
      'navigation_ready'
    ];

    phaseNames.forEach(name => {
      this.state.phases.set(name, {
        name,
        status: 'pending'
      });
    });

    console.log('[UnifiedInit] Initialization phases created:', Array.from(this.state.phases.keys()));
  }

  public startPhase(phaseName: string): void {
    const phase = this.state.phases.get(phaseName);
    if (!phase) return;

    phase.status = 'running';
    phase.startTime = Date.now();
    
    console.log(`[UnifiedInit] Phase started: ${phaseName}`);
    this.notifyListeners();

    // Set timeout for each phase
    setTimeout(() => {
      if (phase.status === 'running') {
        this.timeoutPhase(phaseName);
      }
    }, this.getPhaseTimeout(phaseName));
  }

  public completePhase(phaseName: string, error?: string): void {
    const phase = this.state.phases.get(phaseName);
    if (!phase) return;

    phase.status = error ? 'error' : 'completed';
    phase.endTime = Date.now();
    if (error) phase.error = error;

    console.log(`[UnifiedInit] Phase ${error ? 'failed' : 'completed'}: ${phaseName}`, 
                phase.endTime && phase.startTime ? `(${phase.endTime - phase.startTime}ms)` : '');

    this.updateOverallState();
    this.notifyListeners();
  }

  private timeoutPhase(phaseName: string): void {
    const phase = this.state.phases.get(phaseName);
    if (!phase || phase.status !== 'running') return;

    phase.status = 'timeout';
    phase.endTime = Date.now();
    
    console.warn(`[UnifiedInit] Phase timeout: ${phaseName}`);
    this.updateOverallState();
    this.notifyListeners();
  }

  private getPhaseTimeout(phaseName: string): number {
    const timeouts = {
      app_init: 5000,
      native_services: 8000,
      auth_stabilization: this.state.isNativeApp ? 6000 : 3000,
      session_validation: this.state.isNativeApp ? 5000 : 8000,
      capacitor_ready: 10000,
      onboarding_check: 3000,
      navigation_ready: 2000
    };
    
    return timeouts[phaseName as keyof typeof timeouts] || 5000;
  }

  private updateOverallState(): void {
    const phases = Array.from(this.state.phases.values());
    const hasErrors = phases.some(p => p.status === 'error' || p.status === 'timeout');
    const isComplete = phases.every(p => 
      p.status === 'completed' || p.status === 'error' || p.status === 'timeout'
    );

    this.state.hasErrors = hasErrors;
    this.state.isComplete = isComplete;
    this.state.totalTimeMs = Date.now() - this.startTime;

    if (isComplete) {
      console.log(`[UnifiedInit] Initialization complete in ${this.state.totalTimeMs}ms`, {
        hasErrors,
        phases: Object.fromEntries(
          Array.from(this.state.phases.entries()).map(([name, phase]) => [
            name, 
            { status: phase.status, duration: phase.endTime && phase.startTime ? phase.endTime - phase.startTime : 0 }
          ])
        )
      });
    }
  }

  public getState(): InitializationState {
    return { ...this.state };
  }

  public subscribe(listener: (state: InitializationState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('[UnifiedInit] Error in listener:', error);
      }
    });
  }

  public forceComplete(reason: string = 'Manual override'): void {
    console.warn(`[UnifiedInit] Force completing initialization: ${reason}`);
    
    Array.from(this.state.phases.values()).forEach(phase => {
      if (phase.status === 'running' || phase.status === 'pending') {
        phase.status = 'timeout';
        phase.endTime = Date.now();
        phase.error = `Forced completion: ${reason}`;
      }
    });

    this.updateOverallState();
    this.notifyListeners();
  }

  public reset(): void {
    console.log('[UnifiedInit] Resetting initialization state');
    this.startTime = Date.now();
    this.initializePhases();
    this.state.isComplete = false;
    this.state.hasErrors = false;
    this.state.totalTimeMs = 0;
    this.notifyListeners();
  }
}

export const unifiedInitializationManager = UnifiedInitializationManager.getInstance();