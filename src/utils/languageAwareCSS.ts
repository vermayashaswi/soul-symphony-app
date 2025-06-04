
/**
 * Language-aware CSS utility functions
 * 
 * This utility provides helper functions for applying language-specific
 * CSS adjustments to prevent layout issues with different languages.
 */

import { getLanguageFontConfig, getLanguageFontCSS } from './languageFontScaling';

/**
 * Generate CSS custom properties for language scaling
 */
export function generateLanguageScaleCSS(languageCode: string): string {
  const config = getLanguageFontConfig(languageCode);
  
  return `
    --lang-scale: ${config.scale};
    --lang-line-height: ${config.lineHeightAdjustment || 0}em;
    --lang-letter-spacing: ${config.letterSpacingAdjustment || 0}px;
  `;
}

/**
 * Apply language-specific CSS classes
 */
export function getLanguageAwareClasses(
  languageCode: string,
  baseClasses: string = ''
): string {
  const config = getLanguageFontConfig(languageCode);
  
  const languageClasses = [
    baseClasses,
    'transition-all duration-200', // Smooth transitions when language changes
  ];
  
  // Add specific classes based on language characteristics
  if (config.scale < 0.9) {
    languageClasses.push('text-xs'); // Smaller text for languages that need more scaling
  }
  
  if (config.letterSpacingAdjustment && config.letterSpacingAdjustment < 0) {
    languageClasses.push('tracking-tight'); // Tighter letter spacing
  }
  
  if (config.lineHeightAdjustment && config.lineHeightAdjustment > 0) {
    languageClasses.push('leading-relaxed'); // More line height for complex scripts
  }
  
  return languageClasses.filter(Boolean).join(' ');
}

/**
 * Create inline styles for language-specific adjustments
 */
export function createLanguageAwareStyle(
  languageCode: string,
  additionalStyles: React.CSSProperties = {}
): React.CSSProperties {
  const languageCSSProps = getLanguageFontCSS(languageCode);
  
  return {
    ...languageCSSProps,
    ...additionalStyles,
  };
}

/**
 * Responsive font size calculator that considers language scaling
 */
export function getResponsiveFontSize(
  baseSizePx: number,
  languageCode: string,
  isMobile: boolean = false
): string {
  const config = getLanguageFontConfig(languageCode);
  let adjustedSize = baseSizePx * config.scale;
  
  // Additional mobile adjustments
  if (isMobile && config.scale < 0.9) {
    adjustedSize = Math.max(adjustedSize, 11); // Minimum readable size on mobile
  }
  
  return `${adjustedSize}px`;
}

/**
 * Generate CSS for container that holds language-scaled text
 */
export function getContainerAdjustments(
  languageCode: string,
  isMobile: boolean = false
): React.CSSProperties {
  const config = getLanguageFontConfig(languageCode);
  
  const styles: React.CSSProperties = {};
  
  // If text is significantly scaled down, we might need to adjust container
  if (config.scale < 0.9 && isMobile) {
    styles.overflow = 'hidden';
    styles.textOverflow = 'ellipsis';
    styles.whiteSpace = 'nowrap';
  }
  
  return styles;
}
