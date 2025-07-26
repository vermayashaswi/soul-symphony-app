import { useState, useEffect } from 'react';
import { unifiedInitializationManager } from '@/services/unifiedInitializationManager';

interface InitializationState {
  phases: Map<string, any>;
  isComplete: boolean;
  hasErrors: boolean;
  totalTimeMs: number;
  isNativeApp: boolean;
}

export const useUnifiedInitialization = () => {
  const [state, setState] = useState<InitializationState>(
    unifiedInitializationManager.getState()
  );

  useEffect(() => {
    const unsubscribe = unifiedInitializationManager.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, []);

  const startPhase = (phaseName: string) => {
    unifiedInitializationManager.startPhase(phaseName);
  };

  const completePhase = (phaseName: string, error?: string) => {
    unifiedInitializationManager.completePhase(phaseName, error);
  };

  const forceComplete = (reason?: string) => {
    unifiedInitializationManager.forceComplete(reason);
  };

  const reset = () => {
    unifiedInitializationManager.reset();
  };

  return {
    state,
    startPhase,
    completePhase,
    forceComplete,
    reset,
    // Convenience getters
    isComplete: state.isComplete,
    hasErrors: state.hasErrors,
    isNativeApp: state.isNativeApp,
    phases: Array.from(state.phases.entries())
  };
};