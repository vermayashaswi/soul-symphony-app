import { useState, useCallback, useRef } from 'react';

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitorInterval?: number;
}

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number | null;
  nextAttemptTime: number | null;
}

export const useCircuitBreaker = (
  operation: () => Promise<any>,
  options: CircuitBreakerOptions
) => {
  const [state, setState] = useState<CircuitBreakerState>({
    state: 'CLOSED',
    failureCount: 0,
    lastFailureTime: null,
    nextAttemptTime: null
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const execute = useCallback(async () => {
    const currentState = stateRef.current;
    const now = Date.now();

    // Check if circuit is open and if we should try to close it
    if (currentState.state === 'OPEN') {
      if (currentState.nextAttemptTime && now < currentState.nextAttemptTime) {
        throw new Error('Circuit breaker is OPEN - operation blocked');
      }
      
      // Try to move to HALF_OPEN state
      setState(prev => ({ ...prev, state: 'HALF_OPEN' }));
    }

    try {
      const result = await operation();
      
      // Success - reset circuit breaker
      setState({
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null
      });
      
      return result;
    } catch (error) {
      const newFailureCount = currentState.failureCount + 1;
      const newState: CircuitBreakerState = {
        state: newFailureCount >= options.failureThreshold ? 'OPEN' : 'CLOSED',
        failureCount: newFailureCount,
        lastFailureTime: now,
        nextAttemptTime: newFailureCount >= options.failureThreshold 
          ? now + options.resetTimeout 
          : null
      };
      
      setState(newState);
      
      console.log(`[CircuitBreaker] Failure ${newFailureCount}/${options.failureThreshold}, state: ${newState.state}`);
      
      throw error;
    }
  }, [operation, options]);

  const reset = useCallback(() => {
    setState({
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: null,
      nextAttemptTime: null
    });
  }, []);

  const isBlocked = state.state === 'OPEN' && 
    state.nextAttemptTime && 
    Date.now() < state.nextAttemptTime;

  return {
    execute,
    reset,
    state: state.state,
    failureCount: state.failureCount,
    isBlocked
  };
};