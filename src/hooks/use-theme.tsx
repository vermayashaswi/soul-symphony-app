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
      setSystemTheme(e.matches ? 'dark' : 'light');
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
      }
    };
    
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
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
      root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
      root.style.setProperty('--ring', `${h} ${s}% ${l}%`);
      
      const style = document.getElementById('theme-colors-style') || document.createElement('style');
      style.id = 'theme-colors-style';
      
      style.textContent = `
        .text-theme-color { color: ${primaryHex} !important; }
        .border-theme-color { border-color: ${primaryHex} !important; }
        .bg-theme-color { background-color: ${primaryHex} !important; }
        .hover\\:bg-theme-color:hover { background-color: ${primaryHex} !important; }
        .hover\\:text-theme-color:hover { color: ${primaryHex} !important; }
        .hover\\:border-theme-color:hover { border-color: ${primaryHex} !important; }
        .focus\\:ring-theme-color:focus { --tw-ring-color: ${primaryHex} !important; }
        .stroke-theme-color { stroke: ${primaryHex} !important; }
        .fill-theme-color { fill: ${primaryHex} !important; }
        
        button.bg-theme-color { background-color: ${primaryHex} !important; }
        button.text-theme-color { color: ${primaryHex} !important; }
        button.border-theme-color { border-color: ${primaryHex} !important; }
        
        .icon-theme-color { color: ${primaryHex} !important; }
        .icon-theme-color svg { color: ${primaryHex} !important; }
        
        h1.text-theme-color, h2.text-theme-color, h3.text-theme-color, 
        h4.text-theme-color, h5.text-theme-color, h6.text-theme-color,
        p.text-theme-color, span.text-theme-color { color: ${primaryHex} !important; }
      `;
      document.head.appendChild(style);
      
      document.documentElement.style.setProperty('--primary-h', `${h}`);
      document.documentElement.style.setProperty('--primary-s', `${s}%`);
      document.documentElement.style.setProperty('--primary-l', `${l}%`);
    }
  }, [colorTheme, customColor]);

  useEffect(() => {
    localStorage.setItem('feelosophy-custom-color', customColor);
    
    if (colorTheme === 'Custom') {
      const root = window.document.documentElement;
      root.style.setProperty('--color-theme', customColor);
      
      const primaryRgb = hexToRgb(customColor);
      if (primaryRgb) {
        const [h, s, l] = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
        root.style.setProperty('--ring', `${h} ${s}% ${l}%`);
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
