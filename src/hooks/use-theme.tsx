
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
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('feelosophy-theme');
    return (savedTheme as Theme) || 'system';
  });
  
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    const savedColorTheme = localStorage.getItem('feelosophy-color-theme');
    return (savedColorTheme as ColorTheme) || 'Calm';
  });

  const [customColor, setCustomColor] = useState<string>(() => {
    const savedCustomColor = localStorage.getItem('feelosophy-custom-color');
    return savedCustomColor || '#3b82f6';
  });

  useEffect(() => {
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
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    
    localStorage.setItem('feelosophy-theme', theme);
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
    }
  }, [colorTheme, customColor]);

  // This effect specifically handles when custom color changes
  useEffect(() => {
    localStorage.setItem('feelosophy-custom-color', customColor);
    
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
