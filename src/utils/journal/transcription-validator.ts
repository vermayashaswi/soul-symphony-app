import { logger } from '@/utils/logger';

const validationLogger = logger.createLogger('TranscriptionValidator');

/**
 * Detects repetitive patterns in transcribed text that might indicate API issues
 */
export function detectRepetitivePatterns(text: string): boolean {
  if (!text || text.length < 50) return false;
  
  // Split into sentences/phrases
  const sentences = text.split(/[।.!?\n]+/).filter(s => s.trim().length > 10);
  
  if (sentences.length < 2) return false;
  
  // Check for exact repetitions
  const sentenceMap = new Map<string, number>();
  
  for (const sentence of sentences) {
    const cleanSentence = sentence.trim().toLowerCase();
    if (cleanSentence.length > 10) {
      const count = sentenceMap.get(cleanSentence) || 0;
      sentenceMap.set(cleanSentence, count + 1);
      
      // If any sentence appears more than 2 times, it's likely repetitive
      if (count >= 2) {
        validationLogger.warn('Repetitive pattern detected', { 
          sentence: cleanSentence.substring(0, 50),
          count: count + 1 
        });
        return true;
      }
    }
  }
  
  // Check for similar phrase repetitions (fuzzy matching)
  const phrases = sentences.map(s => s.trim().toLowerCase());
  for (let i = 0; i < phrases.length - 1; i++) {
    for (let j = i + 1; j < phrases.length; j++) {
      const similarity = calculateSimilarity(phrases[i], phrases[j]);
      if (similarity > 0.8 && phrases[i].length > 20) {
        validationLogger.warn('Similar phrase repetition detected', { 
          phrase1: phrases[i].substring(0, 30),
          phrase2: phrases[j].substring(0, 30),
          similarity 
        });
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Calculate similarity between two strings (basic implementation)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Clean up repetitive transcription text
 */
export function deduplicateTranscription(text: string): string {
  if (!text || !detectRepetitivePatterns(text)) {
    return text;
  }
  
  validationLogger.info('Cleaning up repetitive transcription');
  
  // Split into sentences and remove exact duplicates
  const sentences = text.split(/[।.!?\n]+/).filter(s => s.trim().length > 5);
  const uniqueSentences = [];
  const seenSentences = new Set();
  
  for (const sentence of sentences) {
    const cleanSentence = sentence.trim().toLowerCase();
    if (!seenSentences.has(cleanSentence) && cleanSentence.length > 10) {
      seenSentences.add(cleanSentence);
      uniqueSentences.push(sentence.trim());
    }
  }
  
  const cleanedText = uniqueSentences.join('. ');
  
  validationLogger.info('Transcription cleaned', {
    originalLength: text.length,
    cleanedLength: cleanedText.length,
    originalSentences: sentences.length,
    uniqueSentences: uniqueSentences.length
  });
  
  return cleanedText;
}

/**
 * Validate transcription quality
 */
export function validateTranscriptionQuality(text: string): {
  isValid: boolean;
  issues: string[];
  cleanedText?: string;
} {
  const issues: string[] = [];
  
  if (!text || text.trim().length === 0) {
    issues.push('Empty transcription');
    return { isValid: false, issues };
  }
  
  if (text.length < 10) {
    issues.push('Transcription too short');
  }
  
  if (detectRepetitivePatterns(text)) {
    issues.push('Repetitive patterns detected');
    const cleanedText = deduplicateTranscription(text);
    return { 
      isValid: cleanedText.length > 20, 
      issues, 
      cleanedText 
    };
  }
  
  // Check for excessive repetition of single characters or words
  const words = text.split(/\s+/);
  const wordCounts = new Map<string, number>();
  
  for (const word of words) {
    if (word.length > 3) {
      const count = wordCounts.get(word.toLowerCase()) || 0;
      wordCounts.set(word.toLowerCase(), count + 1);
      
      if (count > Math.max(3, words.length * 0.1)) {
        issues.push(`Word "${word}" repeated excessively`);
      }
    }
  }
  
  return { 
    isValid: issues.length === 0, 
    issues 
  };
}