import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useContextReadiness } from '@/contexts/ContextReadinessManager';
import { useTheme } from '@/hooks/use-theme';

interface AnimationReadinessState {
  isReady: boolean;
  themeReady: boolean;
  dimensionsStable: boolean;
}

interface AnimationReadinessContextType extends AnimationReadinessState {
  markDimensionsStable: () => void;
}

const AnimationReadinessContext = createContext<AnimationReadinessContextType | undefined>(undefined);

export function AnimationReadinessProvider({ children }: { children: ReactNode }) {
  const { isReady: contextReady } = useContextReadiness();
  const [dimensionsStable, setDimensionsStable] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  
  // Check if theme is ready
  const theme = useTheme();
  
  useEffect(() => {
    // Theme is ready when we have a valid theme context
    if (theme && theme.colorTheme) {
      setThemeReady(true);
    }
  }, [theme]);

  // Auto-stabilize dimensions after a brief delay
  useEffect(() => {
    if (contextReady && themeReady) {
      const timer = setTimeout(() => {
        setDimensionsStable(true);
      }, 200); // Allow time for layout to settle

      return () => clearTimeout(timer);
    }
  }, [contextReady, themeReady]);

  const isReady = contextReady && themeReady && dimensionsStable;

  const markDimensionsStable = () => {
    setDimensionsStable(true);
  };

  return (
    <AnimationReadinessContext.Provider value={{ 
      isReady,
      themeReady,
      dimensionsStable,
      markDimensionsStable
    }}>
      {children}
    </AnimationReadinessContext.Provider>
  );
}

export function useAnimationReadiness() {
  const context = useContext(AnimationReadinessContext);
  if (context === undefined) {
    throw new Error('useAnimationReadiness must be used within an AnimationReadinessProvider');
  }
  return context;
}