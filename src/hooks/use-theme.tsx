
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = 'light' | 'dark' | 'system';
type ColorTheme = 'Default' | 'Calm' | 'Soothing' | 'Energy' | 'Focus' | 'Custom';

interface ThemeProviderProps {
  children: React.ReactNode;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  customColor: string;
  setCustomColor: (color: string) => void;
  systemTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Safe localStorage access
const safeLocalStorageGet = (key: string, defaultValue: string): string => {
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch {
    return defaultValue;
  }
};

// Safe localStorage set
const safeLocalStorageSet = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Silently fail if localStorage is not available
  }
};

// Safe media query check
const safeMediaQueryCheck = (): 'light' | 'dark' => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Simplified state management for better memory efficiency
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('feelosophy-theme') as Theme) || 'system';
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
  
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    try {
      return (localStorage.getItem('feelosophy-color-theme') as ColorTheme) || 'Calm';
    } catch {
      return 'Calm';
    }
  });

  const [customColor, setCustomColor] = useState<string>(() => {
    try {
      return localStorage.getItem('feelosophy-custom-color') || '#3b82f6';
    } catch {
      return '#3b82f6';
    }
  });

  // Initialize provider
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Optimized media query listener with cleanup
  useEffect(() => {
    let mediaQuery: MediaQueryList | null = null;
    
    try {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = () => {
        setSystemTheme(mediaQuery?.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => {
        if (mediaQuery) {
          mediaQuery.removeEventListener('change', handleChange);
        }
      };
    } catch (error) {
      console.warn('[Theme] Media query setup failed:', error);
      return () => {};
    }
  }, []);

  // Debounced theme application to reduce DOM operations
  useEffect(() => {
    const timeoutId = setTimeout(() => {
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
        console.warn('[Theme] Failed to apply theme:', error);
      }
    }, 50); // Small debounce to batch DOM updates

    return () => clearTimeout(timeoutId);
  }, [theme, systemTheme]);
  
  const getColorHex = (theme: ColorTheme): string => {
    switch (theme) {
      case 'Default':
        return '#3b82f6';
      case 'Calm':
        return '#8b5cf6';
      case 'Soothing':
        return '#FFDEE2';
      case 'Energy':
        return '#f59e0b';
      case 'Focus':
        return '#10b981';
      case 'Custom':
        return customColor;
      default:
        return '#3b82f6';
    }
  };
  
  const hexToRgb = (hex: string): { r: number, g: number, b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };
  
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

  // Simplified and optimized color theme application
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem('feelosophy-color-theme', colorTheme);
        
        const root = window.document.documentElement;
        const primaryHex = getColorHex(colorTheme);
        root.style.setProperty('--color-theme', primaryHex);
        
        const primaryRgb = hexToRgb(primaryHex);
        
        if (primaryRgb) {
          const [h, s, l] = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);
          
          // Update essential CSS variables only
          root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
          root.style.setProperty('--ring', `${h} ${s}% ${l}%`);
          root.style.setProperty('--primary-h', `${h}`);
          root.style.setProperty('--primary-s', `${s}%`);
          root.style.setProperty('--primary-l', `${l}%`);
        }
      } catch (error) {
        console.warn('[Theme] Color theme application error:', error);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [colorTheme, customColor]);

  // Simplified custom color handling
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem('feelosophy-custom-color', customColor);
      } catch (error) {
        console.warn('[Theme] Failed to save custom color:', error);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [customColor]);

  // Don't render children until provider is initialized
  if (!isInitialized) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      colorTheme, 
      setColorTheme, 
      customColor, 
      setCustomColor,
      systemTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  try {
    const context = useContext(ThemeContext);
    if (context === undefined) {
      console.warn('[useTheme] ThemeProvider context is undefined, returning safe defaults. Call stack:', new Error().stack);
      // Return safe defaults to prevent app crash
      return {
        theme: 'system' as const,
        setTheme: () => {},
        colorTheme: 'Default' as const,
        setColorTheme: () => {},
        customColor: '#3b82f6',
        setCustomColor: () => {},
        systemTheme: 'light' as const,
      };
    }
    return context;
  } catch (error) {
    console.error('[useTheme] Error accessing theme context, returning safe defaults. Error:', error);
    console.error('[useTheme] Call stack:', new Error().stack);
    // Return safe defaults to prevent app crash
    return {
      theme: 'system' as const,
      setTheme: () => {},
      colorTheme: 'Default' as const,
      setColorTheme: () => {},
      customColor: '#3b82f6',
      setCustomColor: () => {},
      systemTheme: 'light' as const,
    };
  }
}

// Export a default useTheme to override any external theme hooks that might be conflicting
export default useTheme;
