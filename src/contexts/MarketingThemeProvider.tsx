
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
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const savedTheme = localStorage.getItem('feelosophy-theme');
      return (savedTheme as Theme) || 'system';
    } catch {
      return 'system';
    }
  });
  
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e: MediaQueryListEvent) => {
        const newSystemTheme = e.matches ? 'dark' : 'light';
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
      console.warn('Error setting up media query listener:', error);
    }
  }, [theme]);

  useEffect(() => {
    try {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      
      if (theme === 'system') {
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
      
      localStorage.setItem('feelosophy-theme', theme);
    } catch (error) {
      console.warn('Error applying theme:', error);
    }
  }, [theme, systemTheme]);

  const contextValue: MarketingThemeContextType = {
    theme,
    setTheme,
    systemTheme
  };

  return (
    <MarketingThemeContext.Provider value={contextValue}>
      {children}
    </MarketingThemeContext.Provider>
  );
}

export function useMarketingTheme() {
  const context = useContext(MarketingThemeContext);
  if (context === undefined) {
    // Return safe defaults if called outside provider
    return {
      theme: 'light' as Theme,
      setTheme: () => {},
      systemTheme: 'light' as const
    };
  }
  return context;
}
