
import { useTheme } from '@/hooks/use-theme';

export function useUserColorThemeHex() {
  const { colorTheme, customColor } = useTheme();
  
  // Enhanced color theme handling with WebView and native app compatibility
  const getThemeHex = (): string => {
    switch (colorTheme) {
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
  
  const themeHex = getThemeHex();
  
  // Enhanced WebView and native app color validation and force application
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
    try {
      const isWebView = () => {
        const userAgent = navigator.userAgent;
        return userAgent.includes('wv') || 
               userAgent.includes('WebView') || 
               userAgent.includes('PWABuilder') ||
               userAgent.includes('TWA') ||
               window.location.protocol === 'file:' ||
               (window as any).AndroidInterface !== undefined ||
               (window as any).webkit?.messageHandlers !== undefined;
      };
      
      if (isWebView()) {
        // Validate and force reapply if needed
        const root = document.documentElement;
        const appliedColor = root.style.getPropertyValue('--color-theme');
        const hasWebViewClass = document.body.classList.contains('webview-theme-applied');
        
        if (appliedColor !== themeHex || !hasWebViewClass) {
          console.log('[useUserColorThemeHex] WebView theme inconsistency detected, forcing reapplication:', {
            expected: themeHex,
            applied: appliedColor,
            hasWebViewClass
          });
          
          // Force immediate reapplication
          root.style.setProperty('--color-theme', themeHex, 'important');
          root.style.setProperty('--primary', convertHexToHsl(themeHex), 'important');
          root.style.setProperty('--ring', convertHexToHsl(themeHex), 'important');
          
          document.body.classList.add('webview-theme-applied');
          
          // Apply direct styling to critical elements
          setTimeout(() => {
            const elements = document.querySelectorAll('.text-theme, .bg-theme, .border-theme, .text-primary, .bg-primary, .border-primary');
            elements.forEach(el => {
              const element = el as HTMLElement;
              if (element.classList.contains('text-theme') || element.classList.contains('text-primary')) {
                element.style.setProperty('color', themeHex, 'important');
              }
              if (element.classList.contains('bg-theme') || element.classList.contains('bg-primary')) {
                element.style.setProperty('background-color', themeHex, 'important');
              }
              if (element.classList.contains('border-theme') || element.classList.contains('border-primary')) {
                element.style.setProperty('border-color', themeHex, 'important');
              }
            });
          }, 50);
        }
      }
    } catch (error) {
      console.warn('[useUserColorThemeHex] Theme validation/application failed:', error);
    }
  }
  
  return themeHex;
}

// Helper function to convert hex to HSL
function convertHexToHsl(hex: string): string {
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
}
