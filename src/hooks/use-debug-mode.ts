
import { useState, useCallback } from 'react';

export function useDebugMode() {
  const [showDebugMode, setShowDebugMode] = useState(false);
  
  const toggleDebugMode = useCallback(() => {
    setShowDebugMode(prev => !prev);
  }, []);
  
  return {
    showDebugMode,
    toggleDebugMode
  };
}
