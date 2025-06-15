
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = 'light' | 'dark' | 'system';

interface MarketingThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  systemTheme: 'light' | 'dark';
}

const MarketingThemeContext = createContext<MarketingThemeContextType | undefined>(undefined);

interface MarketingThemeProviderProps {
  children: ReactNode;
}

export function MarketingThemeProvider({ children }: MarketingThemeProviderProps) {
  console.log('[MarketingThemeProvider] Initializing...');
  
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const savedTheme = localStorage.getItem('marketing-theme');
      const result = (savedTheme as Theme) || 'light';
      console.log('[MarketingThemeProvider] Initial theme:', result);
      return result;
    } catch (error) {
      console.warn('[MarketingThemeProvider] Error reading theme from localStorage:', error);
      return 'light';
    }
  });
  
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    try {
      const result = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      console.log('[MarketingThemeProvider] Initial system theme:', result);
      return result;
    } catch (error) {
      console.warn('[MarketingThemeProvider] Error detecting system theme:', error);
      return 'light';
    }
  });

  useEffect(() => {
    console.log('[MarketingThemeProvider] Setting up media query listener...');
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e: MediaQueryListEvent) => {
        const newSystemTheme = e.matches ? 'dark' : 'light';
        console.log('[MarketingThemeProvider] System theme changed to:', newSystemTheme);
        setSystemTheme(newSystemTheme);
        
        if (theme === 'system') {
          const root = window.document.documentElement;
          root.classList.remove('light', 'dark');
          root.classList.add(newSystemTheme);
        }
      };
      
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
      
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      }
      
      mediaQuery.addEventListener('change', handleChange);
      
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    } catch (error) {
      console.warn('[MarketingThemeProvider] Error setting up media query listener:', error);
    }
  }, [theme]);

  useEffect(() => {
    console.log('[MarketingThemeProvider] Applying theme:', theme, 'systemTheme:', systemTheme);
    try {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      
      if (theme === 'system') {
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
      
      localStorage.setItem('marketing-theme', theme);
    } catch (error) {
      console.warn('[MarketingThemeProvider] Error applying theme:', error);
    }
  }, [theme, systemTheme]);

  const contextValue: MarketingThemeContextType = {
    theme,
    setTheme,
    systemTheme
  };

  console.log('[MarketingThemeProvider] Providing context value:', contextValue);

  return (
    <MarketingThemeContext.Provider value={contextValue}>
      {children}
    </MarketingThemeContext.Provider>
  );
}

export function useMarketingTheme() {
  const context = useContext(MarketingThemeContext);
  if (context === undefined) {
    console.warn('[useMarketingTheme] Called outside of MarketingThemeProvider, returning defaults');
    // Return safe defaults if called outside provider
    return {
      theme: 'light' as Theme,
      setTheme: () => {},
      systemTheme: 'light' as const
    };
  }
  return context;
}
