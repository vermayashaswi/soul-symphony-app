
import { createContext, useContext, useEffect, useState } from "react";

type Theme = 'light' | 'dark' | 'system';
type ColorTheme = 'Default' | 'Calm' | 'Soothing' | 'Energy' | 'Focus';

interface ThemeProviderProps {
  children: React.ReactNode;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('feelosophy-theme');
    return (savedTheme as Theme) || 'light';
  });
  
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    const savedColorTheme = localStorage.getItem('feelosophy-color-theme');
    return (savedColorTheme as ColorTheme) || 'Default';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    
    localStorage.setItem('feelosophy-theme', theme);
  }, [theme]);
  
  useEffect(() => {
    localStorage.setItem('feelosophy-color-theme', colorTheme);
    
    // Apply color theme
    const root = window.document.documentElement;
    root.style.setProperty('--color-theme', getColorHex(colorTheme));
  }, [colorTheme]);

  const getColorHex = (theme: ColorTheme): string => {
    switch (theme) {
      case 'Default':
        return '#7c3aed'; // violet-600
      case 'Calm':
        return '#3b82f6'; // blue-500
      case 'Soothing':
        return '#8b5cf6'; // violet-500
      case 'Energy':
        return '#f59e0b'; // amber-500
      case 'Focus':
        return '#10b981'; // emerald-500
      default:
        return '#7c3aed'; // Default fallback
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
