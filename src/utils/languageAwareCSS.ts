
// Language-aware CSS utilities for dynamic styling based on language characteristics

import { getLanguageFontScale, hasCustomScale } from './languageFontScaling';

/**
 * Generate CSS classes for language-specific font scaling
 * @param languageCode - ISO 639-1 language code
 * @param baseSize - Base font size for English (e.g., 'text-sm', 'text-base')
 * @returns Tailwind CSS classes with appropriate sizing
 */
export function getLanguageAwareFontClass(languageCode: string, baseSize: string = 'text-base'): string {
  if (!hasCustomScale(languageCode)) {
    return baseSize;
  }
  
  const scale = getLanguageFontScale(languageCode);
  
  // Map scale factors to Tailwind sizes
  if (scale <= 0.80) return 'text-xs';
  if (scale <= 0.85) return 'text-sm';
  if (scale <= 0.90) return 'text-sm';
  if (scale <= 0.95) return baseSize === 'text-lg' ? 'text-base' : 'text-sm';
  if (scale >= 1.05) return baseSize === 'text-sm' ? 'text-base' : 'text-lg';
  
  return baseSize;
}

/**
 * Get inline styles for precise font scaling
 * @param languageCode - ISO 639-1 language code
 * @param baseFontSize - Base font size (e.g., '16px', '1rem')
 * @returns CSS style object with scaled fontSize
 */
export function getLanguageAwareFontStyle(languageCode: string, baseFontSize: string = '1rem'): React.CSSProperties {
  if (!hasCustomScale(languageCode)) {
    return { fontSize: baseFontSize };
  }
  
  const scale = getLanguageFontScale(languageCode);
  
  // Handle different font size formats
  if (baseFontSize.includes('rem')) {
    const baseValue = parseFloat(baseFontSize.replace('rem', ''));
    return { fontSize: `${baseValue * scale}rem` };
  }
  
  if (baseFontSize.includes('px')) {
    const baseValue = parseFloat(baseFontSize.replace('px', ''));
    return { fontSize: `${baseValue * scale}px` };
  }
  
  if (baseFontSize.includes('em')) {
    const baseValue = parseFloat(baseFontSize.replace('em', ''));
    return { fontSize: `${baseValue * scale}em` };
  }
  
  // Fallback for numeric values (assume px)
  const numericValue = parseFloat(baseFontSize);
  if (!isNaN(numericValue)) {
    return { fontSize: `${numericValue * scale}px` };
  }
  
  console.warn(`[LanguageAwareCSS] Could not parse font size: ${baseFontSize}`);
  return { fontSize: baseFontSize };
}

/**
 * Get CSS class names for responsive language scaling
 * @param languageCode - ISO 639-1 language code
 * @returns CSS class string for responsive behavior
 */
export function getLanguageResponsiveClass(languageCode: string): string {
  if (!hasCustomScale(languageCode)) {
    return '';
  }
  
  const scale = getLanguageFontScale(languageCode);
  
  // Return classes that help with layout for scaled text
  const classes = [];
  
  if (scale < 0.9) {
    classes.push('leading-relaxed'); // Better line height for smaller text
  }
  
  if (scale < 0.85) {
    classes.push('tracking-wide'); // Better letter spacing for very small text
  }
  
  return classes.join(' ');
}

/**
 * Check if text might overflow with current language scaling
 * @param languageCode - ISO 639-1 language code
 * @param textLength - Length of the text content
 * @returns True if text might cause layout issues
 */
export function checkTextOverflowRisk(languageCode: string, textLength: number): boolean {
  const scale = getLanguageFontScale(languageCode);
  
  // If scaling makes text larger and text is long, there's overflow risk
  if (scale > 1.0 && textLength > 50) {
    return true;
  }
  
  // If scaling makes text much smaller, readability might be an issue
  if (scale < 0.8 && textLength > 100) {
    return true;
  }
  
  return false;
}

/**
 * Get recommended container classes for language-specific content
 * @param languageCode - ISO 639-1 language code
 * @returns CSS classes for optimal container styling
 */
export function getLanguageContainerClass(languageCode: string): string {
  if (!hasCustomScale(languageCode)) {
    return '';
  }
  
  const scale = getLanguageFontScale(languageCode);
  const classes = [];
  
  // For languages that scale down significantly, ensure minimum readability
  if (scale < 0.85) {
    classes.push('min-h-[2.5rem]'); // Ensure minimum height
  }
  
  // For languages that scale up, ensure enough space
  if (scale > 1.02) {
    classes.push('min-h-[3rem]'); // More space for larger text
  }
  
  return classes.join(' ');
}
