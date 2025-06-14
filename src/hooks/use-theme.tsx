
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

export function ThemeProvider({ children }: ThemeProviderProps) {
  console.log('[ThemeProvider] Initializing theme provider...');
  
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const savedTheme = localStorage.getItem('feelosophy-theme');
      console.log('[ThemeProvider] Loaded saved theme:', savedTheme);
      return (savedTheme as Theme) || 'system';
    } catch (error) {
      console.warn('[ThemeProvider] Error loading saved theme:', error);
      return 'system';
    }
  });
  
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    try {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      console.log('[ThemeProvider] System theme detected:', isSystemDark ? 'dark' : 'light');
      return isSystemDark ? 'dark' : 'light';
    } catch (error) {
      console.warn('[ThemeProvider] Error detecting system theme:', error);
      return 'light';
    }
  });
  
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    try {
      const savedColorTheme = localStorage.getItem('feelosophy-color-theme');
      console.log('[ThemeProvider] Loaded saved color theme:', savedColorTheme);
      return (savedColorTheme as ColorTheme) || 'Calm';
    } catch (error) {
      console.warn('[ThemeProvider] Error loading saved color theme:', error);
      return 'Calm';
    }
  });

  const [customColor, setCustomColor] = useState<string>(() => {
    try {
      const savedCustomColor = localStorage.getItem('feelosophy-custom-color');
      console.log('[ThemeProvider] Loaded saved custom color:', savedCustomColor);
      return savedCustomColor || '#3b82f6';
    } catch (error) {
      console.warn('[ThemeProvider] Error loading saved custom color:', error);
      return '#3b82f6';
    }
  });

  useEffect(() => {
    try {
      console.log('[ThemeProvider] Setting up system theme listener...');
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e: MediaQueryListEvent) => {
        const newSystemTheme = e.matches ? 'dark' : 'light';
        console.log('[ThemeProvider] System theme changed to:', newSystemTheme);
        setSystemTheme(newSystemTheme);
        
        if (theme === 'system') {
          const root = window.document.documentElement;
          root.classList.remove('light', 'dark');
          root.classList.add(newSystemTheme);
          console.log('[ThemeProvider] Applied system theme to document:', newSystemTheme);
        }
      };
      
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
      
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
        console.log('[ThemeProvider] Applied initial system theme to document');
      }
      
      mediaQuery.addEventListener('change', handleChange);
      
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    } catch (error) {
      console.error('[ThemeProvider] Error setting up system theme listener:', error);
    }
  }, [theme]);

  useEffect(() => {
    try {
      console.log('[ThemeProvider] Applying theme:', theme, 'systemTheme:', systemTheme);
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      
      if (theme === 'system') {
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
      
      localStorage.setItem('feelosophy-theme', theme);
      console.log('[ThemeProvider] Theme applied and saved successfully');
    } catch (error) {
      console.error('[ThemeProvider] Error applying theme:', error);
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
      console.log('[ThemeProvider] Applying color theme:', colorTheme);
      localStorage.setItem('feelosophy-color-theme', colorTheme);
      
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
        
        console.log('[ThemeProvider] Color theme applied successfully');
      }
    } catch (error) {
      console.error('[ThemeProvider] Error applying color theme:', error);
    }
  }, [colorTheme, customColor]);

  // This effect specifically handles when custom color changes
  useEffect(() => {
    try {
      localStorage.setItem('feelosophy-custom-color', customColor);
      
      // Only update the theme if currently using Custom theme
      if (colorTheme === 'Custom') {
        console.log('[ThemeProvider] Updating custom color:', customColor);
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
      console.error('[ThemeProvider] Error updating custom color:', error);
    }
  }, [customColor, colorTheme]);

  console.log('[ThemeProvider] Theme provider initialized successfully');

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
