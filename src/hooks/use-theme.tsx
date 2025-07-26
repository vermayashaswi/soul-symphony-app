
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
  // All hooks must be called at the top level, unconditionally
  const [theme, setTheme] = useState<Theme>(() => {
    return (safeLocalStorageGet('feelosophy-theme', 'system') as Theme) || 'system';
  });
  
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    return safeMediaQueryCheck();
  });
  
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    return (safeLocalStorageGet('feelosophy-color-theme', 'Calm') as ColorTheme) || 'Calm';
  });

  const [customColor, setCustomColor] = useState<string>(() => {
    return safeLocalStorageGet('feelosophy-custom-color', '#3b82f6');
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
      console.warn('Theme system theme detection error:', error);
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
      
      safeLocalStorageSet('feelosophy-theme', theme);
    } catch (error) {
      console.warn('Theme application error:', error);
    }
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

  useEffect(() => {
    try {
      safeLocalStorageSet('feelosophy-color-theme', colorTheme);
      
      const root = window.document.documentElement;
      const primaryHex = getColorHex(colorTheme);
      root.style.setProperty('--color-theme', primaryHex);
      
      const primaryRgb = hexToRgb(primaryHex);
      
      if (primaryRgb) {
        const [h, s, l] = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        
        // Update the primary and ring HSL variables
        root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
        root.style.setProperty('--ring', `${h} ${s}% ${l}%`);
        
        // Update primary-h, primary-s, primary-l for components that use direct HSL values
        root.style.setProperty('--primary-h', `${h}`);
        root.style.setProperty('--primary-s', `${s}%`);
        root.style.setProperty('--primary-l', `${l}%`);
        
        // Create or update style element for global theme colors
        const style = document.getElementById('theme-colors-style') || document.createElement('style');
        style.id = 'theme-colors-style';
        
        // Apply more comprehensive CSS variables and utility classes
        style.textContent = `
          :root {
            --theme-color: ${primaryHex};
            --theme-color-rgb: ${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b};
            --theme-light: color-mix(in srgb, ${primaryHex} 30%, white);
            --theme-lighter: color-mix(in srgb, ${primaryHex} 15%, white);
            --theme-dark: color-mix(in srgb, ${primaryHex} 30%, black);
            --theme-darker: color-mix(in srgb, ${primaryHex} 50%, black);
          }
          .text-theme { color: ${primaryHex} !important; }
          .text-theme-light { color: var(--theme-light) !important; }
          .text-theme-dark { color: var(--theme-dark) !important; }
          
          .bg-theme { background-color: ${primaryHex} !important; }
          .bg-theme-light { background-color: var(--theme-light) !important; }
          .bg-theme-lighter { background-color: var(--theme-lighter) !important; }
          .bg-theme-dark { background-color: var(--theme-dark) !important; }
          
          .border-theme { border-color: ${primaryHex} !important; }
          .ring-theme { --tw-ring-color: ${primaryHex} !important; }
          
          .stroke-theme { stroke: ${primaryHex} !important; }
          .fill-theme { fill: ${primaryHex} !important; }
          
          .hover\\:bg-theme:hover { background-color: ${primaryHex} !important; }
          .hover\\:text-theme:hover { color: ${primaryHex} !important; }
          .hover\\:border-theme:hover { border-color: ${primaryHex} !important; }
          
          .text-theme-color, .theme-text { color: ${primaryHex} !important; }
          .bg-theme-color, .theme-bg { background-color: ${primaryHex} !important; }
          .border-theme-color, .theme-border { border-color: ${primaryHex} !important; }
          
          button.theme-button, 
          .theme-button {
            background-color: ${primaryHex} !important;
            color: white !important;
          }
          
          button.theme-button-outline, 
          .theme-button-outline {
            background-color: transparent !important;
            border-color: ${primaryHex} !important;
            color: ${primaryHex} !important;
          }
          
          .theme-shadow {
            box-shadow: 0 4px 14px rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.25) !important;
          }
        `;
        
        if (!document.getElementById('theme-colors-style')) {
          document.head.appendChild(style);
        }
      }
    } catch (error) {
      console.warn('Color theme application error:', error);
    }
  }, [colorTheme, customColor]);

  // This effect specifically handles when custom color changes
  useEffect(() => {
    try {
      safeLocalStorageSet('feelosophy-custom-color', customColor);
      
      // Only update the theme if currently using Custom theme
      if (colorTheme === 'Custom') {
        const root = window.document.documentElement;
        root.style.setProperty('--color-theme', customColor);
        
        const primaryRgb = hexToRgb(customColor);
        if (primaryRgb) {
          const [h, s, l] = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);
          root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
          root.style.setProperty('--ring', `${h} ${s}% ${l}%`);
          root.style.setProperty('--primary-h', `${h}`);
          root.style.setProperty('--primary-s', `${s}%`);
          root.style.setProperty('--primary-l', `${l}%`);
        }
      }
    } catch (error) {
      console.warn('Custom color application error:', error);
    }
  }, [customColor, colorTheme]);

  return (
    <ThemeContext.Provider 
      value={{ 
        theme, 
        setTheme, 
        colorTheme, 
        setColorTheme, 
        customColor, 
        setCustomColor,
        systemTheme 
      }}
      data-theme-provider="true"
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // CRITICAL DEBUGGING: Log everything to identify the problem component
    console.error('🚨 THEME ERROR DEBUGGING:');
    console.error('URL:', window.location.href);
    console.error('Pathname:', window.location.pathname);
    console.error('Stack trace:', new Error().stack);
    
    // Log the current React component tree for debugging
    const componentTrace = new Error().stack?.split('\n').slice(1, 10).join('\n') || 'No stack';
    console.error('Component trace:', componentTrace);
    
    // Add timestamp to ensure this is the latest version
    console.error('Debug timestamp:', Date.now());
    console.error('Force rebuild check:', '__THEME_DEBUG__');
    
    // Return safe defaults to prevent crash but still identify the issue
    console.warn('⚠️ Returning safe defaults to prevent app crash');
    return {
      theme: 'system' as const,
      setTheme: () => console.debug('[SAFE] setTheme called'),
      colorTheme: 'Calm' as const,
      setColorTheme: () => console.debug('[SAFE] setColorTheme called'),
      customColor: '#8b5cf6',
      setCustomColor: () => console.debug('[SAFE] setCustomColor called'),
      systemTheme: 'light' as const,
    };
  }
  return context;
}
