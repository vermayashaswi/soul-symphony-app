
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
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('feelosophy-theme');
    return (savedTheme as Theme) || 'light';
  });
  
  // Changed default color theme to 'Calm'
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    const savedColorTheme = localStorage.getItem('feelosophy-color-theme');
    return (savedColorTheme as ColorTheme) || 'Calm'; // Default to 'Calm'
  });

  const [customColor, setCustomColor] = useState<string>(() => {
    const savedCustomColor = localStorage.getItem('feelosophy-custom-color');
    return savedCustomColor || '#3b82f6'; // Default to blue
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
    const primaryHex = getColorHex(colorTheme);
    root.style.setProperty('--color-theme', primaryHex);
    
    // Update primary color based on the selected theme
    const primaryRgb = hexToRgb(primaryHex);
    
    if (primaryRgb) {
      // Convert RGB to HSL for primary color
      const [h, s, l] = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
      root.style.setProperty('--ring', `${h} ${s}% ${l}%`); // Also update ring color
      
      // Add CSS variable for colored text
      root.style.setProperty('--theme-color', primaryHex);
      
      // Create theme CSS variables for text, border and background
      const style = document.getElementById('theme-colors-style') || document.createElement('style');
      style.id = 'theme-colors-style';
      
      // Apply more comprehensive color utility classes for different states and components
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
        
        /* For button elements */
        button.bg-theme-color { background-color: ${primaryHex} !important; }
        button.text-theme-color { color: ${primaryHex} !important; }
        button.border-theme-color { border-color: ${primaryHex} !important; }
        
        /* For special icons that need theme colors */
        .icon-theme-color { color: ${primaryHex} !important; }
        .icon-theme-color svg { color: ${primaryHex} !important; }
        
        /* For headings and text elements */
        h1.text-theme-color, h2.text-theme-color, h3.text-theme-color, 
        h4.text-theme-color, h5.text-theme-color, h6.text-theme-color,
        p.text-theme-color, span.text-theme-color { color: ${primaryHex} !important; }
      `;
      document.head.appendChild(style);
      
      // Apply CSS custom properties for components that use HSL values directly
      const [h2, s2, l2] = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      document.documentElement.style.setProperty('--primary-h', `${h2}`);
      document.documentElement.style.setProperty('--primary-s', `${s2}%`);
      document.documentElement.style.setProperty('--primary-l', `${l2}%`);
    }
  }, [colorTheme, customColor]);

  // Save custom color to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('feelosophy-custom-color', customColor);
    // If colorTheme is Custom, update the CSS variables
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

  const getColorHex = (theme: ColorTheme): string => {
    switch (theme) {
      case 'Default':
        return '#3b82f6'; // Changed Default to blue-500 (same as Calm)
      case 'Calm':
        return '#8b5cf6'; // Changed Calm to violet-500 (what was previously Soothing)
      case 'Soothing':
        return '#FFDEE2'; // Changed to light pink
      case 'Energy':
        return '#f59e0b'; // amber-500
      case 'Focus':
        return '#10b981'; // emerald-500
      case 'Custom':
        return customColor; // Return custom color
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
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      colorTheme, 
      setColorTheme, 
      customColor, 
      setCustomColor 
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
