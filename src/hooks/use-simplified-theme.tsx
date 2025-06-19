
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { unifiedNativeAppService } from "@/services/unifiedNativeAppService";

type Theme = 'light' | 'dark' | 'system';
type ColorTheme = 'Default' | 'Calm' | 'Soothing' | 'Energy' | 'Focus' | 'Custom';

interface SimplifiedThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  customColor: string;
  setCustomColor: (color: string) => void;
  systemTheme: 'light' | 'dark';
  themeHex: string;
}

const SimplifiedThemeContext = createContext<SimplifiedThemeContextType | undefined>(undefined);

// Safe localStorage access
const safeLocalStorageGet = (key: string, defaultValue: string): string => {
  try {
    const value = localStorage.getItem(key);
    return value !== null ? value : defaultValue;
  } catch {
    return defaultValue;
  }
};

const safeLocalStorageSet = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    console.warn('[SimplifiedTheme] LocalStorage unavailable');
  }
};

// Get system theme preference
const getSystemTheme = (): 'light' | 'dark' => {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  } catch {
    return 'light';
  }
};

// Get color hex for theme
const getColorHex = (theme: ColorTheme, customColor: string): string => {
  switch (theme) {
    case 'Default': return '#3b82f6';
    case 'Calm': return '#8b5cf6';
    case 'Soothing': return '#FFDEE2';
    case 'Energy': return '#f59e0b';
    case 'Focus': return '#10b981';
    case 'Custom': return customColor || '#3b82f6';
    default: return '#3b82f6';
  }
};

// Convert hex to HSL for CSS variables
const convertHexToHsl = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '217 91.2% 59.8%';
  
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  
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
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

// Apply theme to DOM
const applyTheme = (
  theme: Theme, 
  colorTheme: ColorTheme, 
  customColor: string, 
  systemTheme: 'light' | 'dark'
): void => {
  try {
    const root = document.documentElement;
    const appliedTheme = theme === 'system' ? systemTheme : theme;
    const themeHex = getColorHex(colorTheme, customColor);
    
    // Apply theme class
    root.classList.remove('light', 'dark');
    root.classList.add(appliedTheme);
    
    // Apply CSS variables
    root.style.setProperty('--color-theme', themeHex, 'important');
    root.style.setProperty('--primary', convertHexToHsl(themeHex), 'important');
    root.style.setProperty('--ring', convertHexToHsl(themeHex), 'important');
    
    // Set background and foreground based on theme
    if (appliedTheme === 'dark') {
      root.style.setProperty('--background', '0 0% 3.9%', 'important');
      root.style.setProperty('--foreground', '0 0% 98%', 'important');
    } else {
      root.style.setProperty('--background', '0 0% 100%', 'important');
      root.style.setProperty('--foreground', '0 0% 0%', 'important');
    }
    
    console.log('[SimplifiedTheme] Theme applied:', { appliedTheme, themeHex });
  } catch (error) {
    console.error('[SimplifiedTheme] Theme application failed:', error);
  }
};

// Check if current route is an app route
const isAppRoute = (): boolean => {
  try {
    return window.location.pathname.startsWith('/app');
  } catch {
    return false;
  }
};

export function SimplifiedThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (safeLocalStorageGet('feelosophy-theme', 'system') as Theme) || 'system';
  });
  
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    return getSystemTheme();
  });
  
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    return (safeLocalStorageGet('feelosophy-color-theme', 'Default') as ColorTheme) || 'Default';
  });

  const [customColor, setCustomColor] = useState<string>(() => {
    return safeLocalStorageGet('feelosophy-custom-color', '#3b82f6');
  });

  const themeHex = getColorHex(colorTheme, customColor);

  // Initialize theme on mount
  useEffect(() => {
    console.log('[SimplifiedTheme] Initializing theme system');
    
    // Initialize unified native app service if on app route
    if (isAppRoute()) {
      unifiedNativeAppService.initialize();
    }
    
    // Apply initial theme
    applyTheme(theme, colorTheme, customColor, systemTheme);
    
    // Set up media query listener for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const newSystemTheme = e.matches ? 'dark' : 'light';
      console.log('[SimplifiedTheme] System theme changed:', newSystemTheme);
      setSystemTheme(newSystemTheme);
    };
    
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  // Apply theme when any theme setting changes
  useEffect(() => {
    applyTheme(theme, colorTheme, customColor, systemTheme);
    safeLocalStorageSet('feelosophy-theme', theme);
  }, [theme, systemTheme]);

  useEffect(() => {
    applyTheme(theme, colorTheme, customColor, systemTheme);
    safeLocalStorageSet('feelosophy-color-theme', colorTheme);
  }, [colorTheme, theme, systemTheme]);

  useEffect(() => {
    if (colorTheme === 'Custom') {
      applyTheme(theme, colorTheme, customColor, systemTheme);
    }
    safeLocalStorageSet('feelosophy-custom-color', customColor);
  }, [customColor, colorTheme, theme, systemTheme]);

  return (
    <SimplifiedThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      colorTheme, 
      setColorTheme, 
      customColor, 
      setCustomColor,
      systemTheme,
      themeHex
    }}>
      {children}
    </SimplifiedThemeContext.Provider>
  );
}

export function useSimplifiedTheme() {
  const context = useContext(SimplifiedThemeContext);
  if (context === undefined) {
    throw new Error("useSimplifiedTheme must be used within a SimplifiedThemeProvider");
  }
  return context;
}
