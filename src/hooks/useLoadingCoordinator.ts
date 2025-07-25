import { useState, useEffect, useCallback } from 'react';

interface LoadingState {
  id: string;
  component: string;
  startTime: number;
  timeout?: number;
}

interface LoadingCoordinatorState {
  activeLoaders: LoadingState[];
  isAnyLoading: boolean;
  hasHungLoader: boolean;
}

class LoadingCoordinator {
  private static instance: LoadingCoordinator;
  private listeners: ((state: LoadingCoordinatorState) => void)[] = [];
  private activeLoaders: Map<string, LoadingState> = new Map();
  private readonly HUNG_LOADER_THRESHOLD = 10000; // 10 seconds

  static getInstance(): LoadingCoordinator {
    if (!LoadingCoordinator.instance) {
      LoadingCoordinator.instance = new LoadingCoordinator();
    }
    return LoadingCoordinator.instance;
  }

  subscribe(listener: (state: LoadingCoordinatorState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  getState(): LoadingCoordinatorState {
    const activeLoaders = Array.from(this.activeLoaders.values());
    const now = Date.now();
    
    return {
      activeLoaders,
      isAnyLoading: activeLoaders.length > 0,
      hasHungLoader: activeLoaders.some(loader => 
        now - loader.startTime > this.HUNG_LOADER_THRESHOLD
      )
    };
  }

  startLoading(component: string, timeout?: number): string {
    const id = `${component}-${Date.now()}-${Math.random()}`;
    const loadingState: LoadingState = {
      id,
      component,
      startTime: Date.now(),
      timeout
    };

    this.activeLoaders.set(id, loadingState);
    console.log(`[LoadingCoordinator] Started loading: ${component} (${id})`);
    
    // Set timeout if specified
    if (timeout) {
      setTimeout(() => {
        this.stopLoading(id, 'timeout');
      }, timeout);
    }

    this.notify();
    return id;
  }

  stopLoading(id: string, reason = 'completed'): void {
    const loader = this.activeLoaders.get(id);
    if (loader) {
      const duration = Date.now() - loader.startTime;
      console.log(`[LoadingCoordinator] Stopped loading: ${loader.component} (${id}) - ${reason} after ${duration}ms`);
      this.activeLoaders.delete(id);
      this.notify();
    }
  }

  forceStopAllLoading(reason = 'force-stop'): void {
    console.log('[LoadingCoordinator] Force stopping all loaders:', reason);
    this.activeLoaders.clear();
    this.notify();
  }

  getActiveLoadersByComponent(component: string): LoadingState[] {
    return Array.from(this.activeLoaders.values())
      .filter(loader => loader.component === component);
  }
}

export const useLoadingCoordinator = () => {
  const [state, setState] = useState<LoadingCoordinatorState>({
    activeLoaders: [],
    isAnyLoading: false,
    hasHungLoader: false
  });

  const coordinator = LoadingCoordinator.getInstance();

  useEffect(() => {
    const unsubscribe = coordinator.subscribe(setState);
    setState(coordinator.getState()); // Get initial state
    return unsubscribe;
  }, []);

  const startLoading = useCallback((component: string, timeout?: number) => {
    return coordinator.startLoading(component, timeout);
  }, []);

  const stopLoading = useCallback((id: string, reason?: string) => {
    coordinator.stopLoading(id, reason);
  }, []);

  const forceStopAllLoading = useCallback((reason?: string) => {
    coordinator.forceStopAllLoading(reason);
  }, []);

  const getActiveLoadersByComponent = useCallback((component: string) => {
    return coordinator.getActiveLoadersByComponent(component);
  }, []);

  return {
    ...state,
    startLoading,
    stopLoading,
    forceStopAllLoading,
    getActiveLoadersByComponent
  };
};

export { LoadingCoordinator };