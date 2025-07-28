
import { useTheme } from '@/hooks/use-theme';

export function useUserColorThemeHex() {
  // Defensive theme access with null check
  let colorTheme = 'Default';
  let customColor = '#3b82f6';
  
  // Use a try-catch that actually prevents the error from propagating
  try {
    const themeData = useTheme();
    if (themeData && typeof themeData === 'object') {
      colorTheme = themeData.colorTheme || 'Default';
      customColor = themeData.customColor || '#3b82f6';
    }
  } catch (error) {
    // Silently handle the case where ThemeProvider is not available
    // This prevents the error from bubbling up during SSR or initial render
  }
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
}
