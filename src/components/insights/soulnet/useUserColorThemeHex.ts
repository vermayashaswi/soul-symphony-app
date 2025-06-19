
import { useTheme } from '@/hooks/use-theme';

export function useUserColorThemeHex() {
  const { colorTheme, customColor } = useTheme();
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
