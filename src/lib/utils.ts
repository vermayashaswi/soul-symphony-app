
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function to create a debounced function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Helper function for precise keyboard positioning
export function calculateKeyboardPosition(
  keyboardHeight: number, 
  platform: 'android' | 'ios' | 'web'
): number {
  if (keyboardHeight <= 0) return 0;
  
  // Platform-specific adjustments to eliminate gaps
  const adjustments = {
    android: 1,
    ios: 2,
    web: 1
  };
  
  const adjustment = adjustments[platform] || 1;
  return Math.max(keyboardHeight - adjustment, 0);
}
