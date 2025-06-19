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

// WebView detection utility
const isWebView = (): boolean => {
  try {
    const userAgent = navigator.userAgent;
    return userAgent.includes('wv') || 
           userAgent.includes('WebView') || 
           window.location.protocol === 'file:' ||
           (window as any).AndroidInterface !== undefined ||
           document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1;
  } catch {
    return false;
  }
};

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
  
  // FIXED: Changed default from 'Calm' to 'Default' to match CSS defaults
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    return (safeLocalStorageGet('feelosophy-color-theme', 'Default') as ColorTheme) || 'Default';
  });

  const [customColor, setCustomColor] = useState<string>(() => {
    return safeLocalStorageGet('feelosophy-custom-color', '#3b82f6');
  });

  // Enhanced WebView-specific theme initialization
  useEffect(() => {
    console.log('[Theme] Initializing theme system with WebView support:', { theme, colorTheme, systemTheme });
    
    try {
      const root = window.document.documentElement;
      const body = document.body;
      
      // Apply WebView-specific fixes
      if (isWebView()) {
        console.log('[Theme] WebView detected, applying compatibility fixes');
        
        // Force white background for light mode in WebView
        root.style.setProperty('--background', theme === 'dark' ? '0 0% 3.9%' : '0 0% 100%');
        root.style.setProperty('--card', theme === 'dark' ? '0 0% 3.9%' : '0 0% 100%');
        
        // Add WebView-specific CSS class
        body.classList.add('webview-environment');
        
        // Force background color at body level for WebView
        if (theme === 'light' || (theme === 'system' && systemTheme === 'light')) {
          body.style.backgroundColor = '#ffffff';
          root.style.backgroundColor = '#ffffff';
        } else {
          body.style.backgroundColor = '#0a0a0a';  
          root.style.backgroundColor = '#0a0a0a';
        }
      }
      
      // Apply theme mode immediately
      root.classList.remove('light', 'dark');
      if (theme === 'system') {
        const detectedTheme = safeMediaQueryCheck();
        root.classList.add(detectedTheme);
        setSystemTheme(detectedTheme);
        console.log('[Theme] Applied system theme:', detectedTheme);
      } else {
        root.classList.add(theme);
        console.log('[Theme] Applied explicit theme:', theme);
      }
      
      // Apply color theme immediately
      const primaryHex = getColorHex(colorTheme);
      root.style.setProperty('--color-theme', primaryHex);
      console.log('[Theme] Applied color theme:', colorTheme, primaryHex);
      
    } catch (error) {
      console.warn('[Theme] Initialization error:', error);
    }
  }, []); // Run only once on mount

  // ... keep existing code (media query listener and theme application effects)
  useEffect(() => {
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e: MediaQueryListEvent) => {
        const newSystemTheme = e.matches ? 'dark' : 'light';
        console.log('[Theme] System theme changed:', newSystemTheme);
        setSystemTheme(newSystemTheme);
        
        if (theme === 'system') {
          const root = window.document.documentElement;
          root.classList.remove('light', 'dark');
          root.classList.add(newSystemTheme);
          console.log('[Theme] Applied new system theme:', newSystemTheme);
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
      console.warn('[Theme] System theme detection error:', error);
    }
  }, [theme]);

  useEffect(() => {
    try {
      const root = window.document.documentElement;
      const body = document.body;
      
      root.classList.remove('light', 'dark');
      
      const appliedTheme = theme === 'system' ? systemTheme : theme;
      root.classList.add(appliedTheme);
      
      // Enhanced WebView background fixes
      if (isWebView()) {
        if (appliedTheme === 'light') {
          body.style.backgroundColor = '#ffffff';
          root.style.backgroundColor = '#ffffff';
          root.style.setProperty('--background', '0 0% 100%');
        } else {
          body.style.backgroundColor = '#0a0a0a';
          root.style.backgroundColor = '#0a0a0a';
          root.style.setProperty('--background', '0 0% 3.9%');
        }
      }
      
      console.log('[Theme] Applied theme:', appliedTheme);
      safeLocalStorageSet('feelosophy-theme', theme);
    } catch (error) {
      console.warn('[Theme] Theme application error:', error);
    }
  }, [theme, systemTheme]);
  
  const getColorHex = (theme: ColorTheme): string => {
    switch (theme) {
      case 'Default':
        return '#3b82f6'; // Blue-500 to match CSS defaults
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
        return '#3b82f6'; // Fallback to Default blue
    }
  };
  
  // ... keep existing code (hex to rgb and rgb to hsl conversion functions)
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

  // ... keep existing code (color theme application effect)
  useEffect(() => {
    try {
      console.log('[Theme] Applying color theme:', colorTheme);
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
        
        console.log('[Theme] Applied color variables:', { primaryHex, h, s, l });
        
        // Create or update style element for global theme colors
        const style = document.getElementById('theme-colors-style') || document.createElement('style');
        style.id = 'theme-colors-style';
        
        // Enhanced CSS variables and utility classes with WebView fixes
        style.textContent = `
          :root {
            --theme-color: ${primaryHex};
            --theme-color-rgb: ${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b};
            --theme-light: color-mix(in srgb, ${primaryHex} 30%, white);
            --theme-lighter: color-mix(in srgb, ${primaryHex} 15%, white);
            --theme-dark: color-mix(in srgb, ${primaryHex} 30%, black);
            --theme-darker: color-mix(in srgb, ${primaryHex} 50%, black);
          }
          
          /* WebView-specific fixes */
          .webview-environment {
            -webkit-user-select: none;
            -webkit-touch-callout: none;
            -webkit-tap-highlight-color: transparent;
          }
          
          .webview-environment .journal-arrow-button button {
            -webkit-transform: translate3d(0, 0, 0) !important;
            transform: translate3d(0, 0, 0) !important;
            position: relative !important;
            margin: auto !important;
          }
          
          /* Theme utilities */
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
      console.warn('[Theme] Color theme application error:', error);
    }
  }, [colorTheme, customColor]);

  // ... keep existing code (custom color effect and context provider)
  useEffect(() => {
    try {
      safeLocalStorageSet('feelosophy-custom-color', customColor);
      
      // Only update the theme if currently using Custom theme
      if (colorTheme === 'Custom') {
        console.log('[Theme] Applying custom color:', customColor);
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
      console.warn('[Theme] Custom color application error:', error);
    }
  }, [customColor, colorTheme]);

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
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
