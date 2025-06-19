
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

// Enhanced WebView detection with multiple checks
const isWebView = (): boolean => {
  try {
    const userAgent = navigator.userAgent;
    const isWebViewUA = userAgent.includes('wv') || 
                       userAgent.includes('WebView') || 
                       userAgent.includes('PWABuilder') ||
                       userAgent.includes('TWA') ||
                       userAgent.includes('WebAPK');
    
    const isFileProtocol = window.location.protocol === 'file:';
    const hasAndroidInterface = (window as any).AndroidInterface !== undefined;
    const hasWebkitHandlers = (window as any).webkit?.messageHandlers !== undefined;
    const isNonHTTP = document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1;
    const isPWAStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    
    return isWebViewUA || isFileProtocol || hasAndroidInterface || hasWebkitHandlers || 
           isNonHTTP || (isPWAStandalone && (hasAndroidInterface || hasWebkitHandlers));
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

// Safe localStorage access with WebView compatibility
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
    console.warn('[Theme] LocalStorage unavailable, using memory storage');
  }
};

// Enhanced media query check with fallbacks
const safeMediaQueryCheck = (): 'light' | 'dark' => {
  try {
    if (window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    // Fallback: check time of day for WebView environments
    const hour = new Date().getHours();
    return (hour >= 19 || hour <= 6) ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

// Get color hex with enhanced custom color support
const getColorHex = (theme: ColorTheme, customColor: string): string => {
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
      return customColor || '#3b82f6';
    default:
      return '#3b82f6';
  }
};

// Enhanced WebView CSS reset and theme injection
const forceWebViewThemeApplication = (colorTheme: ColorTheme, customColor: string, appliedTheme: 'light' | 'dark'): void => {
  if (!isAppRoute() || !isWebView()) return;
  
  try {
    console.log('[Theme] WebView: Force applying theme with enhanced injection:', { colorTheme, appliedTheme });
    
    const primaryHex = getColorHex(colorTheme, customColor);
    const root = document.documentElement;
    const body = document.body;
    
    // Step 1: WebView CSS Reset
    let resetStyle = document.getElementById('webview-reset-styles');
    if (!resetStyle) {
      resetStyle = document.createElement('style');
      resetStyle.id = 'webview-reset-styles';
      document.head.insertBefore(resetStyle, document.head.firstChild);
    }
    
    resetStyle.textContent = `
      /* WebView CSS Reset - Force override default styling */
      * {
        -webkit-appearance: none !important;
        -webkit-tap-highlight-color: transparent !important;
        -webkit-user-select: none !important;
        -webkit-touch-callout: none !important;
      }
      
      html, body {
        background-color: ${appliedTheme === 'light' ? '#ffffff' : '#0a0a0a'} !important;
        color: ${appliedTheme === 'light' ? '#000000' : '#ffffff'} !important;
        -webkit-text-size-adjust: 100% !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
      }
      
      /* Reset WebView default button and input styling */
      button, input, select, textarea {
        -webkit-appearance: none !important;
        background: none !important;
        border: none !important;
        outline: none !important;
        font-family: inherit !important;
      }
    `;
    
    // Step 2: Force CSS Variables
    root.style.setProperty('--color-theme', primaryHex, 'important');
    root.style.setProperty('--primary', convertHexToHsl(primaryHex), 'important');
    root.style.setProperty('--ring', convertHexToHsl(primaryHex), 'important');
    root.style.setProperty('--background', appliedTheme === 'light' ? '0 0% 100%' : '0 0% 3.9%', 'important');
    root.style.setProperty('--foreground', appliedTheme === 'light' ? '0 0% 0%' : '0 0% 98%', 'important');
    
    // Step 3: Body attributes and classes
    body.setAttribute('data-app-route', 'true');
    body.classList.add('webview-environment', 'webview-theme-applied');
    body.style.backgroundColor = appliedTheme === 'light' ? '#ffffff' : '#0a0a0a';
    body.style.color = appliedTheme === 'light' ? '#000000' : '#ffffff';
    
    // Step 4: Enhanced WebView Theme Override
    let themeStyle = document.getElementById('webview-theme-override');
    if (!themeStyle) {
      themeStyle = document.createElement('style');
      themeStyle.id = 'webview-theme-override';
      document.head.appendChild(themeStyle);
    }
    
    themeStyle.textContent = `
      /* WebView Theme Override - Maximum Specificity */
      body[data-app-route="true"].webview-environment.webview-theme-applied,
      body[data-app-route="true"].webview-environment.webview-theme-applied * {
        --theme-primary: ${primaryHex} !important;
        --theme-color: ${primaryHex} !important;
      }
      
      /* Theme Color Classes - Maximum Specificity */
      body[data-app-route="true"].webview-environment .text-theme,
      body[data-app-route="true"].webview-environment .text-theme-color,
      body[data-app-route="true"].webview-environment .theme-text,
      body[data-app-route="true"].webview-environment .text-primary { 
        color: ${primaryHex} !important; 
      }
      
      body[data-app-route="true"].webview-environment .bg-theme,
      body[data-app-route="true"].webview-environment .bg-theme-color,
      body[data-app-route="true"].webview-environment .theme-bg,
      body[data-app-route="true"].webview-environment .bg-primary { 
        background-color: ${primaryHex} !important; 
      }
      
      body[data-app-route="true"].webview-environment .border-theme,
      body[data-app-route="true"].webview-environment .border-theme-color,
      body[data-app-route="true"].webview-environment .theme-border,
      body[data-app-route="true"].webview-environment .border-primary { 
        border-color: ${primaryHex} !important; 
      }
      
      /* Button and Interactive Elements */
      body[data-app-route="true"].webview-environment button[class*="primary"],
      body[data-app-route="true"].webview-environment .btn-primary,
      body[data-app-route="true"].webview-environment [data-theme="primary"] {
        background-color: ${primaryHex} !important;
        border-color: ${primaryHex} !important;
        color: white !important;
      }
      
      /* SVG and Icon Colors */
      body[data-app-route="true"].webview-environment .stroke-theme,
      body[data-app-route="true"].webview-environment .fill-theme,
      body[data-app-route="true"].webview-environment [stroke*="primary"],
      body[data-app-route="true"].webview-environment [fill*="primary"] { 
        stroke: ${primaryHex} !important;
        fill: ${primaryHex} !important; 
      }
      
      /* Hover States */
      body[data-app-route="true"].webview-environment .hover\\:bg-theme:hover,
      body[data-app-route="true"].webview-environment .hover\\:bg-primary:hover {
        background-color: ${primaryHex} !important;
        opacity: 0.9 !important;
      }
      
      /* Focus States */
      body[data-app-route="true"].webview-environment .focus\\:ring-theme:focus,
      body[data-app-route="true"].webview-environment .focus\\:ring-primary:focus {
        --tw-ring-color: ${primaryHex} !important;
        box-shadow: 0 0 0 2px ${primaryHex}40 !important;
      }
    `;
    
    // Step 5: Direct DOM element styling for critical elements
    setTimeout(() => {
      const criticalElements = document.querySelectorAll(`
        [class*="theme"], [class*="primary"], 
        button[class*="bg-"], [data-theme],
        .text-theme, .bg-theme, .border-theme
      `);
      
      criticalElements.forEach(el => {
        const element = el as HTMLElement;
        if (element.classList.contains('text-theme') || element.classList.contains('text-primary')) {
          element.style.setProperty('color', primaryHex, 'important');
        }
        if (element.classList.contains('bg-theme') || element.classList.contains('bg-primary')) {
          element.style.setProperty('background-color', primaryHex, 'important');
        }
        if (element.classList.contains('border-theme') || element.classList.contains('border-primary')) {
          element.style.setProperty('border-color', primaryHex, 'important');
        }
      });
    }, 100);
    
    console.log('[Theme] WebView: Enhanced theme application completed:', primaryHex);
    
  } catch (error) {
    console.error('[Theme] WebView: Enhanced theme application failed:', error);
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

// Enhanced theme validation with multiple checks
const validateThemeConsistency = (expectedColor: string): boolean => {
  try {
    const root = document.documentElement;
    const appliedColor = root.style.getPropertyValue('--color-theme');
    const hasWebViewClass = document.body.classList.contains('webview-theme-applied');
    const hasAppRoute = document.body.getAttribute('data-app-route') === 'true';
    
    const isValid = appliedColor === expectedColor && hasWebViewClass && hasAppRoute;
    
    if (!isValid) {
      console.warn('[Theme] Validation failed:', {
        expected: expectedColor,
        applied: appliedColor,
        hasWebViewClass,
        hasAppRoute
      });
    }
    
    return isValid;
  } catch {
    return false;
  }
};

export function ThemeProvider({ children }: ThemeProviderProps) {
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

  // Enhanced initialization for WebView on app routes
  useEffect(() => {
    if (!isAppRoute()) return;
    
    console.log('[Theme] Initializing enhanced WebView theme system:', { 
      theme, 
      colorTheme, 
      systemTheme,
      isWebView: isWebView(),
      pathname: window.location.pathname
    });
    
    const appliedTheme = theme === 'system' ? systemTheme : theme;
    
    // Force immediate theme application for WebView
    if (isWebView()) {
      console.log('[Theme] WebView detected - applying enhanced theme consistency');
      forceWebViewThemeApplication(colorTheme, customColor, appliedTheme);
      
      // Set up periodic validation and re-application
      const validationInterval = setInterval(() => {
        const expectedColor = getColorHex(colorTheme, customColor);
        if (!validateThemeConsistency(expectedColor)) {
          console.log('[Theme] Inconsistency detected, re-applying theme');
          forceWebViewThemeApplication(colorTheme, customColor, appliedTheme);
        }
      }, 3000);
      
      // Clean up interval after 30 seconds
      setTimeout(() => clearInterval(validationInterval), 30000);
    }
    
    // Apply basic theme for all app routes
    try {
      const root = document.documentElement;
      document.body.setAttribute('data-app-route', 'true');
      
      root.classList.remove('light', 'dark');
      root.classList.add(appliedTheme);
      
      const primaryHex = getColorHex(colorTheme, customColor);
      root.style.setProperty('--color-theme', primaryHex, 'important');
      
      console.log('[Theme] Basic theme applied for app route:', appliedTheme, primaryHex);
    } catch (error) {
      console.warn('[Theme] Basic theme application error:', error);
    }
  }, []);

  // Enhanced media query listener with WebView support
  useEffect(() => {
    if (!isAppRoute()) return;
    
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e: MediaQueryListEvent) => {
        const newSystemTheme = e.matches ? 'dark' : 'light';
        console.log('[Theme] System theme changed:', newSystemTheme);
        setSystemTheme(newSystemTheme);
        
        if (theme === 'system') {
          const root = document.documentElement;
          root.classList.remove('light', 'dark');
          root.classList.add(newSystemTheme);
          
          // Re-apply WebView theme for system changes
          if (isWebView()) {
            forceWebViewThemeApplication(colorTheme, customColor, newSystemTheme);
          }
        }
      };
      
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleChange);
      
      return () => mediaQuery.removeEventListener('change', handleChange);
    } catch (error) {
      console.warn('[Theme] Media query listener error:', error);
    }
  }, [theme, colorTheme, customColor]);

  // Enhanced theme application with WebView support
  useEffect(() => {
    if (!isAppRoute()) return;
    
    try {
      const root = document.documentElement;
      const appliedTheme = theme === 'system' ? systemTheme : theme;
      
      root.classList.remove('light', 'dark');
      root.classList.add(appliedTheme);
      
      // Enhanced WebView theme application
      if (isWebView()) {
        forceWebViewThemeApplication(colorTheme, customColor, appliedTheme);
      }
      
      console.log('[Theme] Theme applied:', appliedTheme);
      safeLocalStorageSet('feelosophy-theme', theme);
    } catch (error) {
      console.warn('[Theme] Theme application error:', error);
    }
  }, [theme, systemTheme, colorTheme, customColor]);

  // Enhanced color theme application
  useEffect(() => {
    if (!isAppRoute()) return;
    
    try {
      console.log('[Theme] Applying enhanced color theme:', colorTheme);
      safeLocalStorageSet('feelosophy-color-theme', colorTheme);
      
      const primaryHex = getColorHex(colorTheme, customColor);
      const root = document.documentElement;
      
      // Apply CSS variables
      root.style.setProperty('--color-theme', primaryHex, 'important');
      root.style.setProperty('--primary', convertHexToHsl(primaryHex), 'important');
      root.style.setProperty('--ring', convertHexToHsl(primaryHex), 'important');
      
      // Enhanced WebView color application
      if (isWebView()) {
        const appliedTheme = theme === 'system' ? systemTheme : theme;
        forceWebViewThemeApplication(colorTheme, customColor, appliedTheme);
        
        // Validate after application
        setTimeout(() => {
          if (!validateThemeConsistency(primaryHex)) {
            console.warn('[Theme] Post-application validation failed, retrying...');
            forceWebViewThemeApplication(colorTheme, customColor, appliedTheme);
          }
        }, 500);
      }
      
      console.log('[Theme] Enhanced color theme applied:', primaryHex);
    } catch (error) {
      console.warn('[Theme] Color theme application error:', error);
    }
  }, [colorTheme, customColor, theme, systemTheme]);

  // Enhanced custom color handling
  useEffect(() => {
    if (!isAppRoute()) return;
    
    try {
      safeLocalStorageSet('feelosophy-custom-color', customColor);
      
      if (colorTheme === 'Custom') {
        console.log('[Theme] Applying enhanced custom color:', customColor);
        const root = document.documentElement;
        root.style.setProperty('--color-theme', customColor, 'important');
        root.style.setProperty('--primary', convertHexToHsl(customColor), 'important');
        root.style.setProperty('--ring', convertHexToHsl(customColor), 'important');
        
        // Enhanced WebView custom color application
        if (isWebView()) {
          const appliedTheme = theme === 'system' ? systemTheme : theme;
          forceWebViewThemeApplication('Custom', customColor, appliedTheme);
        }
      }
    } catch (error) {
      console.warn('[Theme] Custom color application error:', error);
    }
  }, [customColor, colorTheme, theme, systemTheme]);

  // Cleanup for non-app routes
  useEffect(() => {
    if (!isAppRoute()) {
      document.body.removeAttribute('data-app-route');
      document.body.classList.remove('webview-environment', 'webview-theme-applied');
      console.log('[Theme] Non-app route detected, cleaning up theme classes');
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
