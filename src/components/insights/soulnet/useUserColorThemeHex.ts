
import { useSimplifiedTheme } from '@/hooks/use-simplified-theme';

export function useUserColorThemeHex() {
  const { themeHex } = useSimplifiedTheme();
  return themeHex;
}
