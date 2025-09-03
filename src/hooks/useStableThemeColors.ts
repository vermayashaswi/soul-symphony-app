import { useMemo } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { useAnimationReadiness } from '@/contexts/AnimationReadinessProvider';

interface ThemeColors {
  main: string;
  secondary: string;
  tertiary: string;
  pulse: string;
  light: string;
}

/**
 * Stable theme colors hook that prevents flickering during theme initialization
 */
export function useStableThemeColors(): ThemeColors {
  const { themeReady } = useAnimationReadiness();
  const theme = useTheme();

  return useMemo(() => {
    // Use fallback colors during initialization
    if (!themeReady) {
      return {
        main: 'rgba(59,130,246,0.6)',
        secondary: 'rgba(37,99,235,0.4)',
        tertiary: 'rgba(29,78,216,0.2)',
        pulse: 'rgba(59,130,246,0.8)',
        light: 'rgba(219,234,254,0.5)'
      };
    }

    const { colorTheme, customColor } = theme;

    switch(colorTheme) {
      case 'Calm':
        return {
          main: 'rgba(139,92,246,0.6)',
          secondary: 'rgba(124,58,237,0.4)',
          tertiary: 'rgba(109,40,217,0.2)',
          pulse: 'rgba(139,92,246,0.8)',
          light: 'rgba(186,230,253,0.5)'
        };
      case 'Energy':
        return {
          main: 'rgba(245,158,11,0.6)',
          secondary: 'rgba(234,88,12,0.4)',
          tertiary: 'rgba(194,65,12,0.2)',
          pulse: 'rgba(245,158,11,0.8)',
          light: 'rgba(254,240,138,0.5)'
        };
      case 'Soothing':
        return {
          main: 'rgba(255,222,226,0.6)',
          secondary: 'rgba(248,180,184,0.4)',
          tertiary: 'rgba(244,114,182,0.2)',
          pulse: 'rgba(244,114,182,0.8)',
          light: 'rgba(253,242,248,0.5)'
        };
      case 'Focus':
        return {
          main: 'rgba(16,185,129,0.6)',
          secondary: 'rgba(5,150,105,0.4)',
          tertiary: 'rgba(6,95,70,0.2)',
          pulse: 'rgba(16,185,129,0.8)',
          light: 'rgba(209,250,229,0.5)'
        };
      case 'Custom':
        const hexToRgba = (hex: string, alpha: number): string => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r},${g},${b},${alpha})`;
        };
        
        return {
          main: hexToRgba(customColor || '#3b82f6', 0.6),
          secondary: hexToRgba(customColor || '#3b82f6', 0.4),
          tertiary: hexToRgba(customColor || '#3b82f6', 0.2),
          pulse: hexToRgba(customColor || '#3b82f6', 0.8),
          light: 'rgba(255,255,255,0.5)'
        };
      default:
        return {
          main: 'rgba(59,130,246,0.6)',
          secondary: 'rgba(37,99,235,0.4)',
          tertiary: 'rgba(29,78,216,0.2)',
          pulse: 'rgba(59,130,246,0.8)',
          light: 'rgba(219,234,254,0.5)'
        };
    }
  }, [themeReady, theme.colorTheme, theme.customColor]);
}