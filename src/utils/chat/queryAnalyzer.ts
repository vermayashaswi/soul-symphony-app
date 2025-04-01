
export const analyzeQueryTypes = (query: string): Record<string, boolean> => {
  const lowerQuery = query.toLowerCase();
  
  // Enhanced quantitative detection with more patterns
  const quantitativeWords = [
    'how many', 'how much', 'count', 'total', 'average', 'avg', 'statistics',
    'stats', 'number', 'percentage', 'percent', 'ratio', 'frequency', 'score',
    'rate', 'top', 'bottom', 'most', 'least', 'highest', 'lowest', 'ranking',
    'rank', 'distribution', 'mean', 'median', 'majority', 'out of', 'scale'
  ];
  
  const comparativeWords = [
    'more than', 'less than', 'greater', 'smaller', 'better', 'worse', 'between',
    'compared to', 'versus', 'vs', 'difference', 'similar', 'most', 'least',
    'highest', 'lowest', 'top', 'bottom', 'maximum', 'minimum', 'max', 'min',
    'best', 'worst', 'stronger', 'weaker', 'dominant', 'primary', 'secondary'
  ];
  
  const temporalWords = [
    'when', 'time', 'date', 'period', 'duration', 'during', 'after', 'before',
    'since', 'until', 'day', 'week', 'month', 'year', 'today', 'yesterday',
    'tomorrow', 'recent', 'last', 'this', 'next', 'previous', 'upcoming',
    'now', 'past', 'future', 'earlier', 'later', 'history', 'trend', 'evolution',
    'progress', 'development', 'growth', 'change', 'transition', 'shift'
  ];
  
  // Expanded emotion vocabulary to catch more subtle references
  const emotionWords = [
    'feel', 'feeling', 'emotion', 'mood', 'happy', 'sad', 'angry', 'anxious',
    'joyful', 'excited', 'disappointed', 'frustrated', 'content', 'hopeful',
    'grateful', 'proud', 'afraid', 'scared', 'worried', 'stressed', 'peaceful',
    'calm', 'love', 'hate', 'fear', 'disgust', 'surprise', 'shame', 'guilt',
    'positive', 'negative', 'neutral', 'depressed', 'ecstatic', 'elated',
    'miserable', 'cheerful', 'gloomy', 'tense', 'relaxed', 'irritated',
    'pleased', 'annoyed', 'fulfilled', 'empty', 'overwhelmed', 'satisfaction',
    'dissatisfaction', 'delight', 'displeasure', 'anguish', 'bliss', 'happiness'
  ];
  
  // Better detection of numbers and counts in queries
  const numberWordPatterns = [
    /\b\d+\b/, /\bone\b/, /\btwo\b/, /\bthree\b/, /\bfour\b/, /\bfive\b/,
    /\bsix\b/, /\bseven\b/, /\beight\b/, /\bnine\b/, /\bten\b/, /\bdozen\b/,
    /\bhundred\b/, /\bthousand\b/, /\bmillion\b/, /\bbillion\b/, /\btrillion\b/,
    /\bfirst\b/, /\bsecond\b/, /\bthird\b/, /\blast\b/, /\bhalf\b/, /\btwice\b/,
    /\bdouble\b/, /\btriple\b/, /\bquadruple\b/, /\bquintuple\b/, /\bmultiple\b/
  ];
  
  // Enhanced pattern detection for top emotions
  const topEmotionsPattern = /(?:top|most|main|primary|strongest|highest|dominant)\s+(?:\d+|few|several)\s+(?:positive|negative|intense|strong)?\s*(?:emotion|emotions|feeling|feelings)/i;
  
  // Enhanced pattern detection for emotion ranking
  const emotionRankingPattern = /(?:rank|ranking|order|sort)\s+(?:of|my|the)?\s*(?:emotion|emotions|feeling|feelings)/i;
  
  // Enhanced pattern detection for emotion changes over time
  const emotionChangePattern = /(?:change|changes|changing|evolution|evolve|evolving|progress|progression|trend|trends|growth|development|shift|transition)\s+(?:in|of|my|the)?\s*(?:emotion|emotions|feeling|feelings)/i;
  
  // Enhanced detection for "when" questions that need temporal context
  const whenQuestionPattern = /\b(?:when|what time|which day|which month|which week|during what|during which)\b/i;
  
  // Check for specific emotion quantification patterns
  const emotionQuantificationPattern = /(?:how|what)\s+(?:much|level|degree|extent|intensity|amount)\s+(?:of|did|do|does|is|am|are|was|were)\s+(?:i|me|my|himself|herself|yourself|they|we|us|you)?\s*(?:feel|feeling|felt|experience|experienced|have|having|had|get|getting|got)\s+(?:a|an)?\s*(?:emotionWord)/i;
  
  // Special pattern for happiness rating
  const happinessRatingPattern = /(?:how|what)\s+(?:much|level|is|was|would you rate)\s+(?:rate|score|my)?\s+(?:my|the)?\s*(?:happiness|joy|content|satisfaction)(?:\s+(?:out of|level|score|rating))?\s*(?:\d+|percent|percentage)?/i;
  
  // New pattern for explicit happiness rating questions like "how much would you rate my happiness out of 100"
  const explicitHappinessRatingPattern = /(?:how|what).*(?:rate|score).*(?:happiness|joy|content|satisfaction).*(?:out of|from|between).*\d+/i;
  
  // Detect complex multi-part queries that should be broken down
  const complexQueryPatterns = [
    // Logical connectors
    /(?:.*and.*){2,}/i,  // Multiple "and" connectors
    /.*and.*but.*/i,     // Mixed "and" and "but"
    /.*but.*and.*/i,     // Mixed "but" and "and"
    /.*while.*also.*/i,  // "while also" construction
    
    // Multiple questions in one
    /\?.*\?/i,           // Multiple question marks
    
    // Comparisons of multiple time periods
    /(?:compare|contrast|difference).*(?:between|of).*(?:and).*/i,
    
    // Multi-faceted questions with combined aspects
    /(?:both|all|several).*(aspect|dimension|factor).*(and).*/i,
    
    // Questions that explicitly state multiple parts
    /(?:first|second|third|lastly|finally|moreover|additionally)/i
  ];
  
  // Create dynamic pattern for each emotion word
  const hasEmotionQuantification = emotionWords.some(emotion => {
    const pattern = new RegExp(emotionQuantificationPattern.source.replace('emotionWord', emotion), 'i');
    return pattern.test(lowerQuery);
  });
  
  const hasHappinessRating = happinessRatingPattern.test(lowerQuery) || explicitHappinessRatingPattern.test(lowerQuery);
  
  const hasQuantitativeWords = quantitativeWords.some(word => 
    lowerQuery.includes(word)
  );
  
  const hasNumbers = numberWordPatterns.some(pattern => 
    pattern.test(lowerQuery)
  );
  
  const hasComparativeWords = comparativeWords.some(word => 
    lowerQuery.includes(word)
  );
  
  const hasTemporalWords = temporalWords.some(word => 
    new RegExp(`\\b${word}\\b`).test(lowerQuery)
  );
  
  const hasEmotionWords = emotionWords.some(word => 
    new RegExp(`\\b${word}\\b`).test(lowerQuery)
  );
  
  const hasTopEmotionsPattern = topEmotionsPattern.test(lowerQuery);
  const hasEmotionRankingPattern = emotionRankingPattern.test(lowerQuery);
  const hasEmotionChangePattern = emotionChangePattern.test(lowerQuery);
  const isWhenQuestion = whenQuestionPattern.test(lowerQuery);
  
  const needsContext = /\bwhy\b|\breason\b|\bcause\b|\bexplain\b|\bunderstand\b|\bmeaning\b|\binterpret\b/.test(lowerQuery);
  
  // Check if query is complex and needs breakdown by components
  const isComplexQuery = complexQueryPatterns.some(pattern => pattern.test(lowerQuery)) ||
                        (lowerQuery.split(' ').length > 12 && 
                         (lowerQuery.includes(' and ') || lowerQuery.includes(' or ') || 
                          lowerQuery.includes(' but ') || lowerQuery.includes(' while ')));
  
  // Enhanced detection for queries that need data aggregation
  const needsDataAggregation = hasTopEmotionsPattern || 
                              hasEmotionRankingPattern || 
                              hasEmotionChangePattern ||
                              hasHappinessRating ||
                              isComplexQuery ||
                              (hasEmotionWords && (hasQuantitativeWords || hasNumbers || hasComparativeWords));
  
  return {
    isQuantitative: hasQuantitativeWords || hasNumbers || hasTopEmotionsPattern || hasEmotionQuantification || hasHappinessRating,
    
    isTemporal: hasTemporalWords,
    
    isComparative: hasComparativeWords || hasTopEmotionsPattern || hasEmotionChangePattern,
    
    isEmotionFocused: hasEmotionWords || hasTopEmotionsPattern || hasEmotionRankingPattern || hasEmotionQuantification || hasHappinessRating,
    
    hasTopEmotionsPattern,
    
    hasEmotionRankingPattern,
    
    hasEmotionChangePattern,
    
    hasEmotionQuantification,
    
    hasHappinessRating,
    
    isWhenQuestion,
    
    needsContext,
    
    needsDataAggregation,
    
    isComplexQuery,
    
    hasExplicitHappinessRating: explicitHappinessRatingPattern.test(lowerQuery),
    
    requiresComponentAnalysis: isComplexQuery || hasHappinessRating || hasTopEmotionsPattern || 
                               (hasTemporalWords && hasEmotionWords && hasQuantitativeWords),
    
    asksForNumber: hasNumbers || hasTopEmotionsPattern || hasHappinessRating || /how many|how much|what percentage|how often|frequency|count|number of/i.test(lowerQuery),
    
    needsVectorSearch: true
  };
};
