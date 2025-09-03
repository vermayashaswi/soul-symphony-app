
/**
 * Language-specific font scaling configuration
 * 
 * This utility provides font scaling factors for different languages
 * to prevent layout issues with text overflow. English is used as the
 * baseline (1.0), and other languages are scaled accordingly.
 */

export interface LanguageFontConfig {
  scale: number;
  lineHeightAdjustment?: number;
  letterSpacingAdjustment?: number;
}

// Font scaling configuration for different languages
// Scale factors are relative to English (1.0 = same size as English)
export const LANGUAGE_FONT_SCALING: Record<string, LanguageFontConfig> = {
  // English - baseline
  'en': { scale: 1.0 },
  
  // European languages that tend to be longer
  'de': { scale: 0.88, letterSpacingAdjustment: -0.2 }, // German - compound words
  'fr': { scale: 0.92, letterSpacingAdjustment: -0.1 }, // French - longer phrases
  'es': { scale: 0.94 }, // Spanish - slightly longer
  'it': { scale: 0.93 }, // Italian - moderate scaling
  'pt': { scale: 0.94 }, // Portuguese
  'ru': { scale: 0.90, letterSpacingAdjustment: -0.1 }, // Russian - Cyrillic can be dense
  
  // Asian languages with different character spacing needs
  'zh': { scale: 0.96, lineHeightAdjustment: 0.1 }, // Chinese - compact characters
  'ja': { scale: 0.94, lineHeightAdjustment: 0.1 }, // Japanese - mixed scripts
  'ko': { scale: 0.95, lineHeightAdjustment: 0.1 }, // Korean - Hangul spacing
  
  // Indian languages that may need adjustment
  'hi': { scale: 0.92, lineHeightAdjustment: 0.1 }, // Hindi - Devanagari script
  'bn': { scale: 0.90, lineHeightAdjustment: 0.1 }, // Bengali
  'ta': { scale: 0.89, lineHeightAdjustment: 0.1 }, // Tamil
  'te': { scale: 0.88, lineHeightAdjustment: 0.1 }, // Telugu
  'kn': { scale: 0.89, lineHeightAdjustment: 0.1 }, // Kannada
  'ml': { scale: 0.87, lineHeightAdjustment: 0.1 }, // Malayalam
  'gu': { scale: 0.91, lineHeightAdjustment: 0.1 }, // Gujarati
  'mr': { scale: 0.90, lineHeightAdjustment: 0.1 }, // Marathi
  'pa': { scale: 0.91, lineHeightAdjustment: 0.1 }, // Punjabi
  'or': { scale: 0.89, lineHeightAdjustment: 0.1 }, // Odia
  
  // Arabic - RTL with different spacing
  'ar': { scale: 0.93, lineHeightAdjustment: 0.1, letterSpacingAdjustment: 0.1 },
};

/**
 * Get font scaling configuration for a specific language
 */
export function getLanguageFontConfig(languageCode: string): LanguageFontConfig {
  return LANGUAGE_FONT_SCALING[languageCode] || LANGUAGE_FONT_SCALING['en'];
}

/**
 * Calculate scaled font size for a given language
 */
export function getScaledFontSize(baseFontSize: number, languageCode: string): number {
  const config = getLanguageFontConfig(languageCode);
  return baseFontSize * config.scale;
}

/**
 * Generate CSS properties for language-specific font adjustments
 */
export function getLanguageFontCSS(languageCode: string): React.CSSProperties {
  const config = getLanguageFontConfig(languageCode);
  
  // Check if app is fully initialized to prevent flicker
  const isAppReady = (window as any).__SOULO_FONTS_READY__ && 
                     (window as any).__SOULO_APP_INITIALIZED__;
  
  const styles: React.CSSProperties = {
    transform: isAppReady ? `scale(${config.scale})` : 'scale(1)',
    transformOrigin: 'left center',
    transition: isAppReady ? 'transform 0.2s ease-out' : 'none',
  };
  
  if (config.lineHeightAdjustment) {
    styles.lineHeight = `calc(1em + ${config.lineHeightAdjustment}em)`;
  }
  
  if (config.letterSpacingAdjustment) {
    styles.letterSpacing = `${config.letterSpacingAdjustment}px`;
  }
  
  return styles;
}

/**
 * Get responsive font scaling classes for Tailwind CSS
 */
export function getLanguageFontClasses(languageCode: string): string {
  const config = getLanguageFontConfig(languageCode);
  
  // Check if app is fully initialized to prevent flicker
  const isAppReady = (window as any).__SOULO_FONTS_READY__ && 
                     (window as any).__SOULO_APP_INITIALIZED__;
  
  if (!isAppReady) {
    return 'origin-left transition-none';
  }
  
  // Create CSS custom properties for the scaling
  const scaleClass = `scale-[${config.scale}]`;
  const originClass = 'origin-left';
  
  return `${scaleClass} ${originClass} transition-transform duration-200 ease-out`;
}

/**
 * Hook to get current language font configuration
 */
export function useLanguageFontConfig(languageCode: string) {
  return {
    config: getLanguageFontConfig(languageCode),
    scaledSize: (baseSize: number) => getScaledFontSize(baseSize, languageCode),
    cssProps: getLanguageFontCSS(languageCode),
    classes: getLanguageFontClasses(languageCode),
  };
}
