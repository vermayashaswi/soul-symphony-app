import { useTheme } from "@/hooks/use-theme"

interface SafeThemeReturn {
  theme: 'light' | 'dark' | 'system'
  systemTheme: 'light' | 'dark'
  colorTheme: string
  isDarkMode: boolean
}

/**
 * A safe version of useTheme that provides fallback values
 * when the ThemeProvider context is not yet available
 */
export function useSafeTheme(): SafeThemeReturn {
  try {
    const { theme, systemTheme, colorTheme } = useTheme()
    const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark')
    
    return {
      theme,
      systemTheme,
      colorTheme,
      isDarkMode
    }
  } catch (error) {
    // Fallback values when ThemeProvider is not available
    const systemPrefersDark = typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-color-scheme: dark)').matches 
      : false
    
    return {
      theme: 'system',
      systemTheme: systemPrefersDark ? 'dark' : 'light',
      colorTheme: 'default',
      isDarkMode: systemPrefersDark
    }
  }
}