
import { useState, useEffect } from 'react';

// Persist chartType via local storage so that navigation doesn't reset chart type for user UX continuity
export function usePersistedState<T>(key: string, defaultValue: T): [T, (val: T) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    }
    return defaultValue;
  });
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(state));
    }
  }, [state, key]);
  
  return [state, setState];
}
