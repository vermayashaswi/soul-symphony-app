
import { useTheme } from '@/hooks/use-theme';

export function useUserColorThemeHex() {
  const { colorTheme, customColor } = useTheme();
  switch (colorTheme) {
    case 'blue':
      return '#3b82f6';
    case 'green':
      return '#10b981';
    case 'purple':
      return '#8b5cf6';
    case 'pink':
      return '#ec4899';
    case 'orange':
      return '#f97316';
    case 'red':
      return '#ef4444';
    case 'teal':
      return '#14b8a6';
    case 'indigo':
      return '#6366f1';
    default:
      return '#3b82f6';
  }
}
