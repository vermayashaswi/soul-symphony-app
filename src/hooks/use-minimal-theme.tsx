
import { createContext, useContext, ReactNode } from "react";

type MinimalTheme = 'light' | 'dark';

interface MinimalThemeContextType {
  theme: MinimalTheme;
  systemTheme: MinimalTheme;
}

const MinimalThemeContext = createContext<MinimalThemeContextType | undefined>(undefined);

interface MinimalThemeProviderProps {
  children: ReactNode;
}

export function MinimalThemeProvider({ children }: MinimalThemeProviderProps) {
  // Use system theme detection without state hooks
  const systemTheme: MinimalTheme = typeof window !== 'undefined' && 
    window.matchMedia && 
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  const contextValue: MinimalThemeContextType = {
    theme: systemTheme,
    systemTheme
  };

  return (
    <MinimalThemeContext.Provider value={contextValue}>
      {children}
    </MinimalThemeContext.Provider>
  );
}

export function useMinimalTheme() {
  const context = useContext(MinimalThemeContext);
  if (context === undefined) {
    // Fallback to light theme if context is unavailable
    return {
      theme: 'light' as MinimalTheme,
      systemTheme: 'light' as MinimalTheme
    };
  }
  return context;
}
