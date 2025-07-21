
import { useSafeAreaUnified } from './use-safe-area-unified';

// Deprecated - use useSafeAreaUnified instead
export const useSafeArea = () => {
  console.warn('useSafeArea is deprecated, use useSafeAreaUnified instead');
  return useSafeAreaUnified();
};
