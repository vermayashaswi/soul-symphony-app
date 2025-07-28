
import { useTheme } from '@/hooks/use-theme';

export function useUserColorThemeHex() {
  // Defensive theme access with null check
  let colorTheme = 'Default';
  let customColor = '#3b82f6';
  
  try {
    const themeData = useTheme();
    if (themeData) {
      colorTheme = themeData.colorTheme || 'Default';
      customColor = themeData.customColor || '#3b82f6';
    }
  } catch (error) {
    // Theme provider not available, using default colors
    // This is expected during SSR or before ThemeProvider is mounted
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
