
import { useAppState } from './useAppState';

// Legacy hook - now uses centralized app state manager
export const useAppInitialization = () => {
  const { isInitialized, isInitializing, error } = useAppState();
  
  return {
    isInitialized,
    isInitializing,
    error
  };
};
