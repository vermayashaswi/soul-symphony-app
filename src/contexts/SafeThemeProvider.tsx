
import React, { ReactNode, useEffect, useState } from 'react';
import { ThemeProvider } from '@/hooks/use-theme';
import { useContextReadiness } from './ContextReadinessManager';

interface SafeThemeProviderProps {
  children: ReactNode;
}

export function SafeThemeProvider({ children }: SafeThemeProviderProps) {
  const { isReady, error, markError } = useContextReadiness();
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    if (isReady && !error) {
      // Add a small delay to ensure all React internals are ready
      const timer = setTimeout(() => {
        setIsThemeReady(true);
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isReady, error]);

  // If contexts aren't ready yet, show a minimal loading state
  if (!isReady || !isThemeReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // If there's an error, show a fallback
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h1>
          <p className="text-gray-600">Please wait while we prepare the page.</p>
        </div>
      </div>
    );
  }

  try {
    return <ThemeProvider>{children}</ThemeProvider>;
  } catch (err) {
    console.error('Theme provider error:', err);
    markError(err as Error);
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h1>
          <p className="text-gray-600">Initializing application...</p>
        </div>
      </div>
    );
  }
}
