/**
 * Generates user-friendly headers for sub-questions based on their content
 */
export function generateUserFriendlyHeader(subQuestion: string): string {
  const lowerQuestion = subQuestion.toLowerCase().trim();
  
  // Remove question marks and normalize
  const cleanQuestion = lowerQuestion.replace(/\?+$/, '');
  
  // Pattern matching for common question types
  const patterns = [
    {
      pattern: /how (often|frequently|much)/,
      keywords: ['fight', 'argue', 'conflict'],
      header: 'Frequency of Conflicts'
    },
    {
      pattern: /how (often|frequently|much)/,
      keywords: ['partner', 'relationship'],
      header: 'Relationship Patterns'
    },
    {
      pattern: /how (often|frequently|much)/,
      keywords: ['emotion', 'feel'],
      header: 'Emotional Frequency'
    },
    {
      pattern: /(what are|which are|what|which).*top.*emotion/,
      keywords: ['fight', 'conflict', 'argue'],
      header: 'Top Emotions During Conflicts'
    },
    {
      pattern: /(what are|which are|what|which).*top.*emotion/,
      keywords: ['work', 'job'],
      header: 'Work-Related Emotions'
    },
    {
      pattern: /(what are|which are|what|which).*emotion/,
      keywords: ['most', 'common', 'frequent'],
      header: 'Most Common Emotions'
    },
    {
      pattern: /when (do|did|am|was)/,
      keywords: ['most', 'least'],
      header: 'Timing Patterns'
    },
    {
      pattern: /(what|which).*theme/,
      keywords: [],
      header: 'Key Themes'
    },
    {
      pattern: /(what|which).*pattern/,
      keywords: [],
      header: 'Behavioral Patterns'
    },
    {
      pattern: /how.*cope|how.*handle|how.*deal/,
      keywords: [],
      header: 'Coping Strategies'
    },
    {
      pattern: /(what|how).*improve|how.*better/,
      keywords: [],
      header: 'Areas for Growth'
    }
  ];
  
  // Try to match patterns
  for (const { pattern, keywords, header } of patterns) {
    if (pattern.test(cleanQuestion)) {
      // If no specific keywords required, or if keywords match
      if (keywords.length === 0 || keywords.some(keyword => cleanQuestion.includes(keyword))) {
        return header;
      }
    }
  }
  
  // Fallback: Extract key terms and create a header
  const keyTerms = extractKeyTerms(cleanQuestion);
  if (keyTerms.length > 0) {
    return capitalizeFirst(keyTerms.join(' '));
  }
  
  // Final fallback: Use a generic but friendly header
  return 'Analysis Results';
}

/**
 * Extract key meaningful terms from a question
 */
function extractKeyTerms(question: string): string[] {
  // Remove common question words
  const stopWords = [
    'what', 'are', 'the', 'how', 'often', 'do', 'i', 'my', 'me', 'with', 'about',
    'in', 'of', 'to', 'and', 'or', 'but', 'is', 'was', 'were', 'been', 'have',
    'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
    'entries', 'journal', 'mention', 'associated', 'attached', 'related'
  ];
  
  const words = question.split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !stopWords.includes(word))
    .slice(0, 3); // Take first 3 meaningful words
  
  return words;
}

/**
 * Capitalize the first letter of a string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate a short, descriptive header for display
 */
export function generateDisplayHeader(subQuestion: string): string {
  const header = generateUserFriendlyHeader(subQuestion);
  
  // Keep headers concise - max 4 words
  const words = header.split(' ');
  if (words.length > 4) {
    return words.slice(0, 4).join(' ');
  }
  
  return header;
}
