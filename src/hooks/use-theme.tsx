
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

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
    return (savedColorTheme as ColorTheme) || 'Calm'; // Changed default to 'Calm'
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
    
    // Apply color theme to CSS variables
    const root = window.document.documentElement;
    root.style.setProperty('--color-theme', getColorHex(colorTheme));
    
    // Update primary color based on the selected theme
    const primaryHex = getColorHex(colorTheme);
    const primaryRgb = hexToRgb(primaryHex);
    
    if (primaryRgb) {
      // Convert RGB to HSL for primary color
      const [h, s, l] = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
    }
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
        return '#3b82f6'; // Default fallback to blue
    }
  };
  
  // Utility function to convert hex to RGB
  const hexToRgb = (hex: string): { r: number, g: number, b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };
  
  // Utility function to convert RGB to HSL
  const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      
      h /= 6;
    }
    
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
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
