
// Language font scaling utility to handle layout issues with long text in certain languages
// Uses English as baseline (1.0) and applies scaling factors for other languages

interface LanguageFontScale {
  code: string;
  name: string;
  scaleFactor: number;
  reason: string;
}

// Font scaling factors based on language characteristics
const LANGUAGE_FONT_SCALES: LanguageFontScale[] = [
  // English baseline
  { code: 'en', name: 'English', scaleFactor: 1.0, reason: 'baseline' },
  
  // Languages with longer text that need smaller fonts
  { code: 'uk', name: 'Ukrainian', scaleFactor: 0.85, reason: 'longer words, complex grammar' },
  { code: 'ta', name: 'Tamil', scaleFactor: 0.82, reason: 'complex script, longer words' },
  { code: 'te', name: 'Telugu', scaleFactor: 0.84, reason: 'complex script, longer words' },
  { code: 'kn', name: 'Kannada', scaleFactor: 0.84, reason: 'complex script, longer words' },
  { code: 'ml', name: 'Malayalam', scaleFactor: 0.82, reason: 'very complex script, longer words' },
  { code: 'hi', name: 'Hindi', scaleFactor: 0.88, reason: 'longer words in translation' },
  { code: 'bn', name: 'Bengali', scaleFactor: 0.86, reason: 'longer words, complex script' },
  { code: 'gu', name: 'Gujarati', scaleFactor: 0.87, reason: 'longer words in translation' },
  { code: 'mr', name: 'Marathi', scaleFactor: 0.86, reason: 'longer words in translation' },
  { code: 'pa', name: 'Punjabi', scaleFactor: 0.87, reason: 'longer words in translation' },
  { code: 'or', name: 'Odia', scaleFactor: 0.85, reason: 'longer words, complex script' },
  
  // European languages that tend to be longer
  { code: 'de', name: 'German', scaleFactor: 0.92, reason: 'compound words, longer phrases' },
  { code: 'ru', name: 'Russian', scaleFactor: 0.90, reason: 'longer words, complex grammar' },
  { code: 'fr', name: 'French', scaleFactor: 0.95, reason: 'slightly longer phrases' },
  { code: 'it', name: 'Italian', scaleFactor: 0.94, reason: 'slightly longer phrases' },
  { code: 'pt', name: 'Portuguese', scaleFactor: 0.93, reason: 'longer phrases' },
  { code: 'es', name: 'Spanish', scaleFactor: 0.96, reason: 'slightly longer phrases' },
  
  // Asian languages
  { code: 'zh', name: 'Chinese', scaleFactor: 1.05, reason: 'compact characters' },
  { code: 'ja', name: 'Japanese', scaleFactor: 1.02, reason: 'compact characters' },
  { code: 'ko', name: 'Korean', scaleFactor: 0.98, reason: 'balanced character density' },
  
  // Arabic
  { code: 'ar', name: 'Arabic', scaleFactor: 0.90, reason: 'right-to-left, longer phrases' },
];

// Create a map for quick lookup
const SCALE_MAP = new Map<string, number>();
LANGUAGE_FONT_SCALES.forEach(lang => {
  SCALE_MAP.set(lang.code, lang.scaleFactor);
});

/**
 * Get font scale factor for a given language
 * @param languageCode - ISO 639-1 language code
 * @returns Scale factor (1.0 = baseline English size)
 */
export function getLanguageFontScale(languageCode: string): number {
  const scale = SCALE_MAP.get(languageCode);
  if (scale === undefined) {
    console.log(`[LanguageFontScaling] No scale defined for ${languageCode}, using baseline 1.0`);
    return 1.0; // Default to baseline if language not found
  }
  
  console.log(`[LanguageFontScaling] Scale factor for ${languageCode}: ${scale}`);
  return scale;
}

/**
 * Apply font scaling to a CSS font size value
 * @param baseFontSize - Base font size (e.g., "16px", "1.2rem", "14")
 * @param languageCode - ISO 639-1 language code
 * @returns Scaled font size string
 */
export function applyLanguageFontScale(baseFontSize: string | number, languageCode: string): string {
  const scale = getLanguageFontScale(languageCode);
  
  // Handle numeric values
  if (typeof baseFontSize === 'number') {
    const scaledSize = baseFontSize * scale;
    console.log(`[LanguageFontScaling] Scaled ${baseFontSize} to ${scaledSize} for ${languageCode}`);
    return `${scaledSize}px`;
  }
  
  // Handle string values with units
  const sizeStr = baseFontSize.toString();
  const match = sizeStr.match(/^(\d*\.?\d+)(.*)$/);
  
  if (!match) {
    console.warn(`[LanguageFontScaling] Could not parse font size: ${sizeStr}`);
    return sizeStr;
  }
  
  const [, numStr, unit] = match;
  const baseNum = parseFloat(numStr);
  const scaledNum = baseNum * scale;
  const result = `${scaledNum}${unit}`;
  
  console.log(`[LanguageFontScaling] Scaled ${sizeStr} to ${result} for ${languageCode}`);
  return result;
}

/**
 * Get all supported languages with their scaling information
 * @returns Array of language scale information
 */
export function getAllLanguageScales(): LanguageFontScale[] {
  return [...LANGUAGE_FONT_SCALES];
}

/**
 * Check if a language has a custom scale factor (different from baseline)
 * @param languageCode - ISO 639-1 language code
 * @returns True if language has custom scaling
 */
export function hasCustomScale(languageCode: string): boolean {
  const scale = getLanguageFontScale(languageCode);
  return scale !== 1.0;
}
