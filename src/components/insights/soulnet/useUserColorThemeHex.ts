
import { useTheme } from '@/hooks/use-theme';

export function useUserColorThemeHex() {
  const { colorTheme, customColor } = useTheme();
  
  // Enhanced color theme handling with WebView compatibility
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
  
  // For WebView environments on app routes, ensure the color is properly applied
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
    try {
      // Validate that the theme color is correctly applied
      const root = document.documentElement;
      const appliedColor = root.style.getPropertyValue('--color-theme');
      
      if (appliedColor !== themeHex) {
        console.log('[useUserColorThemeHex] Theme color mismatch detected, expected:', themeHex, 'got:', appliedColor);
        // Force reapply the color
        root.style.setProperty('--color-theme', themeHex, 'important');
      }
    } catch (error) {
      console.warn('[useUserColorThemeHex] Theme validation failed:', error);
    }
  }
  
  return themeHex;
}
