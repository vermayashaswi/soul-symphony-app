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

// Enhanced WebView detection with route checking
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

// Check if current route is an app route
const isAppRoute = (): boolean => {
  try {
    return window.location.pathname.startsWith('/app');
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

// Direct color injection for WebView
const injectWebViewColors = (colorTheme: ColorTheme, customColor: string, appliedTheme: 'light' | 'dark'): void => {
  if (!isAppRoute() || !isWebView()) return;
  
  try {
    console.log('[Theme] WebView: Injecting direct colors for theme:', colorTheme, appliedTheme);
    
    const primaryHex = getColorHex(colorTheme, customColor);
    const root = document.documentElement;
    
    // Force direct color application with !important
    root.style.setProperty('--color-theme', primaryHex, 'important');
    root.style.setProperty('--primary', convertHexToHsl(primaryHex), 'important');
    root.style.setProperty('--ring', convertHexToHsl(primaryHex), 'important');
    
    // Create or update WebView-specific style injection
    let webViewStyle = document.getElementById('webview-theme-colors');
    if (!webViewStyle) {
      webViewStyle = document.createElement('style');
      webViewStyle.id = 'webview-theme-colors';
      document.head.appendChild(webViewStyle);
    }
    
    // Direct hex values instead of CSS functions for WebView compatibility
    webViewStyle.textContent = `
      /* WebView-specific theme colors with direct hex values */
      .webview-environment {
        --theme-color: ${primaryHex} !important;
        --theme-primary: ${primaryHex} !important;
      }
      
      /* Force theme colors on app routes only */
      body[data-app-route="true"] .text-theme,
      body[data-app-route="true"] .text-theme-color,
      body[data-app-route="true"] .theme-text { 
        color: ${primaryHex} !important; 
      }
      
      body[data-app-route="true"] .bg-theme,
      body[data-app-route="true"] .bg-theme-color,
      body[data-app-route="true"] .theme-bg { 
        background-color: ${primaryHex} !important; 
      }
      
      body[data-app-route="true"] .border-theme,
      body[data-app-route="true"] .border-theme-color,
      body[data-app-route="true"] .theme-border { 
        border-color: ${primaryHex} !important; 
      }
      
      body[data-app-route="true"] .stroke-theme,
      body[data-app-route="true"] .fill-theme { 
        stroke: ${primaryHex} !important;
        fill: ${primaryHex} !important; 
      }
      
      /* Button overrides for WebView */
      body[data-app-route="true"] .webview-environment button.bg-primary,
      body[data-app-route="true"] .webview-environment .bg-primary {
        background-color: ${primaryHex} !important;
      }
      
      body[data-app-route="true"] .webview-environment .text-primary {
        color: ${primaryHex} !important;
      }
      
      body[data-app-route="true"] .webview-environment .border-primary {
        border-color: ${primaryHex} !important;
      }
      
      /* Ensure visibility and proper colors */
      body[data-app-route="true"] .webview-environment {
        -webkit-user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-tap-highlight-color: transparent !important;
        background-color: ${appliedTheme === 'light' ? '#ffffff' : '#0a0a0a'} !important;
      }
    `;
    
    console.log('[Theme] WebView: Direct color injection completed for', primaryHex);
  } catch (error) {
    console.error('[Theme] WebView: Color injection failed:', error);
  }
};

// Convert hex to HSL for CSS variables
const convertHexToHsl = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '217 91.2% 59.8%'; // Default blue
  
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

// Get color hex with custom color support
const getColorHex = (theme: ColorTheme, customColor: string): string => {
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

// Theme validation function
const validateThemeApplication = (expectedColor: string): boolean => {
  try {
    const root = document.documentElement;
    const appliedColor = root.style.getPropertyValue('--color-theme');
    const isValid = appliedColor === expectedColor;
    
    if (!isValid) {
      console.warn('[Theme] Validation failed. Expected:', expectedColor, 'Got:', appliedColor);
    }
    
    return isValid;
  } catch {
    return false;
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
    return (safeLocalStorageGet('feelosophy-color-theme', 'Default') as ColorTheme) || 'Default';
  });

  const [customColor, setCustomColor] = useState<string>(() => {
    return safeLocalStorageGet('feelosophy-custom-color', '#3b82f6');
  });

  // Pre-initialization for WebView on app routes
  useEffect(() => {
    if (!isAppRoute()) return;
    
    console.log('[Theme] App route detected, initializing theme system with WebView support:', { 
      theme, 
      colorTheme, 
      systemTheme,
      isWebView: isWebView(),
      pathname: window.location.pathname
    });
    
    // Mark body as app route for CSS targeting
    document.body.setAttribute('data-app-route', 'true');
    
    try {
      const root = window.document.documentElement;
      const body = document.body;
      
      // Apply WebView-specific fixes immediately
      if (isWebView()) {
        console.log('[Theme] WebView detected on app route, applying compatibility fixes');
        
        // Add WebView-specific CSS class
        body.classList.add('webview-environment');
        
        // Force background color at body level for WebView
        const appliedTheme = theme === 'system' ? systemTheme : theme;
        if (appliedTheme === 'light') {
          body.style.backgroundColor = '#ffffff';
          root.style.backgroundColor = '#ffffff';
          root.style.setProperty('--background', '0 0% 100%', 'important');
        } else {
          body.style.backgroundColor = '#0a0a0a';  
          root.style.backgroundColor = '#0a0a0a';
          root.style.setProperty('--background', '0 0% 3.9%', 'important');
        }
        
        // Immediate color injection for WebView
        injectWebViewColors(colorTheme, customColor, appliedTheme);
      }
      
      // Apply theme mode immediately for app routes
      root.classList.remove('light', 'dark');
      if (theme === 'system') {
        const detectedTheme = safeMediaQueryCheck();
        root.classList.add(detectedTheme);
        setSystemTheme(detectedTheme);
        console.log('[Theme] Applied system theme on app route:', detectedTheme);
      } else {
        root.classList.add(theme);
        console.log('[Theme] Applied explicit theme on app route:', theme);
      }
      
      // Apply color theme immediately for app routes
      const primaryHex = getColorHex(colorTheme, customColor);
      root.style.setProperty('--color-theme', primaryHex, 'important');
      console.log('[Theme] Applied color theme on app route:', colorTheme, primaryHex);
      
      // Validate theme application after a brief delay
      setTimeout(() => {
        if (!validateThemeApplication(primaryHex)) {
          console.warn('[Theme] Theme validation failed, re-applying...');
          injectWebViewColors(colorTheme, customColor, theme === 'system' ? systemTheme : theme);
        }
      }, 500);
      
    } catch (error) {
      console.warn('[Theme] App route initialization error:', error);
    }
  }, []); // Run only once on mount

  // Media query listener for system theme changes
  useEffect(() => {
    if (!isAppRoute()) return;
    
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e: MediaQueryListEvent) => {
        const newSystemTheme = e.matches ? 'dark' : 'light';
        console.log('[Theme] System theme changed on app route:', newSystemTheme);
        setSystemTheme(newSystemTheme);
        
        if (theme === 'system') {
          const root = window.document.documentElement;
          root.classList.remove('light', 'dark');
          root.classList.add(newSystemTheme);
          
          // Re-inject WebView colors for new theme
          if (isWebView()) {
            injectWebViewColors(colorTheme, customColor, newSystemTheme);
          }
          
          console.log('[Theme] Applied new system theme on app route:', newSystemTheme);
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
  }, [theme, colorTheme, customColor]);

  // Theme application effect
  useEffect(() => {
    if (!isAppRoute()) return;
    
    try {
      const root = window.document.documentElement;
      const body = document.body;
      
      root.classList.remove('light', 'dark');
      
      const appliedTheme = theme === 'system' ? systemTheme : theme;
      root.classList.add(appliedTheme);
      
      // Enhanced WebView background fixes for app routes
      if (isWebView()) {
        if (appliedTheme === 'light') {
          body.style.backgroundColor = '#ffffff';
          root.style.backgroundColor = '#ffffff';
          root.style.setProperty('--background', '0 0% 100%', 'important');
        } else {
          body.style.backgroundColor = '#0a0a0a';
          root.style.backgroundColor = '#0a0a0a';
          root.style.setProperty('--background', '0 0% 3.9%', 'important');
        }
        
        // Re-inject colors for new theme
        injectWebViewColors(colorTheme, customColor, appliedTheme);
      }
      
      console.log('[Theme] Applied theme on app route:', appliedTheme);
      safeLocalStorageSet('feelosophy-theme', theme);
    } catch (error) {
      console.warn('[Theme] Theme application error:', error);
    }
  }, [theme, systemTheme, colorTheme, customColor]);
  
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

  // Color theme application effect for app routes
  useEffect(() => {
    if (!isAppRoute()) return;
    
    try {
      console.log('[Theme] Applying color theme on app route:', colorTheme);
      safeLocalStorageSet('feelosophy-color-theme', colorTheme);
      
      const root = window.document.documentElement;
      const primaryHex = getColorHex(colorTheme, customColor);
      root.style.setProperty('--color-theme', primaryHex, 'important');
      
      const primaryRgb = hexToRgb(primaryHex);
      
      if (primaryRgb) {
        const [h, s, l] = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        
        // Update the primary and ring HSL variables with !important for app routes
        root.style.setProperty('--primary', `${h} ${s}% ${l}%`, 'important');
        root.style.setProperty('--ring', `${h} ${s}% ${l}%`, 'important');
        
        // Update primary-h, primary-s, primary-l for components that use direct HSL values
        root.style.setProperty('--primary-h', `${h}`, 'important');
        root.style.setProperty('--primary-s', `${s}%`, 'important');
        root.style.setProperty('--primary-l', `${l}%`, 'important');
        
        console.log('[Theme] Applied color variables on app route:', { primaryHex, h, s, l });
        
        // WebView-specific color injection
        if (isWebView()) {
          const appliedTheme = theme === 'system' ? systemTheme : theme;
          injectWebViewColors(colorTheme, customColor, appliedTheme);
        }
        
        // Create or update style element for global theme colors (app routes only)
        const style = document.getElementById('theme-colors-style') || document.createElement('style');
        style.id = 'theme-colors-style';
        
        // Enhanced CSS variables and utility classes with WebView fixes for app routes
        style.textContent = `
          /* Only apply to app routes */
          body[data-app-route="true"] {
            --theme-color: ${primaryHex} !important;
            --theme-color-rgb: ${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b} !important;
            --theme-light: ${primaryHex}4D !important; /* 30% opacity */
            --theme-lighter: ${primaryHex}26 !important; /* 15% opacity */
            --theme-dark: ${primaryHex} !important;
            --theme-darker: ${primaryHex} !important;
          }
          
          /* WebView-specific fixes for app routes only */
          body[data-app-route="true"].webview-environment {
            -webkit-user-select: none !important;
            -webkit-touch-callout: none !important;
            -webkit-tap-highlight-color: transparent !important;
          }
          
          body[data-app-route="true"].webview-environment .journal-arrow-button button {
            -webkit-transform: translate3d(0, 0, 0) !important;
            transform: translate3d(0, 0, 0) !important;
            position: relative !important;
            margin: auto !important;
          }
          
          /* Theme utilities for app routes only */
          body[data-app-route="true"] .text-theme { color: ${primaryHex} !important; }
          body[data-app-route="true"] .text-theme-light { color: ${primaryHex}80 !important; }
          body[data-app-route="true"] .text-theme-dark { color: ${primaryHex} !important; }
          
          body[data-app-route="true"] .bg-theme { background-color: ${primaryHex} !important; }
          body[data-app-route="true"] .bg-theme-light { background-color: ${primaryHex}4D !important; }
          body[data-app-route="true"] .bg-theme-lighter { background-color: ${primaryHex}26 !important; }
          body[data-app-route="true"] .bg-theme-dark { background-color: ${primaryHex} !important; }
          
          body[data-app-route="true"] .border-theme { border-color: ${primaryHex} !important; }
          body[data-app-route="true"] .ring-theme { --tw-ring-color: ${primaryHex} !important; }
          
          body[data-app-route="true"] .stroke-theme { stroke: ${primaryHex} !important; }
          body[data-app-route="true"] .fill-theme { fill: ${primaryHex} !important; }
          
          body[data-app-route="true"] .hover\\:bg-theme:hover { background-color: ${primaryHex} !important; }
          body[data-app-route="true"] .hover\\:text-theme:hover { color: ${primaryHex} !important; }
          body[data-app-route="true"] .hover\\:border-theme:hover { border-color: ${primaryHex} !important; }
          
          body[data-app-route="true"] .text-theme-color, 
          body[data-app-route="true"] .theme-text { color: ${primaryHex} !important; }
          body[data-app-route="true"] .bg-theme-color, 
          body[data-app-route="true"] .theme-bg { background-color: ${primaryHex} !important; }
          body[data-app-route="true"] .border-theme-color, 
          body[data-app-route="true"] .theme-border { border-color: ${primaryHex} !important; }
          
          body[data-app-route="true"] button.theme-button, 
          body[data-app-route="true"] .theme-button {
            background-color: ${primaryHex} !important;
            color: white !important;
          }
          
          body[data-app-route="true"] button.theme-button-outline, 
          body[data-app-route="true"] .theme-button-outline {
            background-color: transparent !important;
            border-color: ${primaryHex} !important;
            color: ${primaryHex} !important;
          }
          
          body[data-app-route="true"] .theme-shadow {
            box-shadow: 0 4px 14px ${primaryHex}40 !important;
          }
        `;
        
        if (!document.getElementById('theme-colors-style')) {
          document.head.appendChild(style);
        }
        
        // Validate theme application
        setTimeout(() => {
          validateThemeApplication(primaryHex);
        }, 200);
      }
    } catch (error) {
      console.warn('[Theme] Color theme application error:', error);
    }
  }, [colorTheme, customColor, theme, systemTheme]);

  // Custom color effect for app routes
  useEffect(() => {
    if (!isAppRoute()) return;
    
    try {
      safeLocalStorageSet('feelosophy-custom-color', customColor);
      
      // Only update the theme if currently using Custom theme
      if (colorTheme === 'Custom') {
        console.log('[Theme] Applying custom color on app route:', customColor);
        const root = window.document.documentElement;
        root.style.setProperty('--color-theme', customColor, 'important');
        
        const primaryRgb = hexToRgb(customColor);
        if (primaryRgb) {
          const [h, s, l] = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);
          root.style.setProperty('--primary', `${h} ${s}% ${l}%`, 'important');
          root.style.setProperty('--ring', `${h} ${s}% ${l}%`, 'important');
          root.style.setProperty('--primary-h', `${h}`, 'important');
          root.style.setProperty('--primary-s', `${s}%`, 'important');
          root.style.setProperty('--primary-l', `${l}%`, 'important');
          
          // WebView-specific injection for custom color
          if (isWebView()) {
            const appliedTheme = theme === 'system' ? systemTheme : theme;
            injectWebViewColors('Custom', customColor, appliedTheme);
          }
        }
      }
    } catch (error) {
      console.warn('[Theme] Custom color application error:', error);
    }
  }, [customColor, colorTheme, theme, systemTheme]);

  // Cleanup effect for non-app routes
  useEffect(() => {
    if (!isAppRoute()) {
      document.body.removeAttribute('data-app-route');
      document.body.classList.remove('webview-environment');
      console.log('[Theme] Non-app route detected, skipping app-specific theme logic');
    }
  }, []);

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
