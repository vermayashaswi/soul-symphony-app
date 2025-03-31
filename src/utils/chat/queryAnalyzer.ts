
export const analyzeQueryTypes = (query: string): Record<string, boolean> => {
  const lowerQuery = query.toLowerCase();
  
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
    'now', 'past', 'future', 'earlier', 'later', 'history', 'trend'
  ];
  
  const emotionWords = [
    'feel', 'feeling', 'emotion', 'mood', 'happy', 'sad', 'angry', 'anxious',
    'joyful', 'excited', 'disappointed', 'frustrated', 'content', 'hopeful',
    'grateful', 'proud', 'afraid', 'scared', 'worried', 'stressed', 'peaceful',
    'calm', 'love', 'hate', 'fear', 'disgust', 'surprise', 'shame', 'guilt',
    'positive', 'negative', 'neutral'
  ];
  
  const numberWordPatterns = [
    /\b\d+\b/, /\bone\b/, /\btwo\b/, /\bthree\b/, /\bfour\b/, /\bfive\b/,
    /\bsix\b/, /\bseven\b/, /\beight\b/, /\bnine\b/, /\bten\b/, /\bdozen\b/,
    /\bhundred\b/, /\bthousand\b/, /\bmillion\b/, /\bbillion\b/, /\btrillion\b/,
    /\bfirst\b/, /\bsecond\b/, /\bthird\b/, /\blast\b/, /\bhalf\b/, /\btwice\b/,
    /\bdouble\b/, /\btriple\b/, /\bquadruple\b/, /\bquintuple\b/, /\bmultiple\b/
  ];
  
  const topEmotionsPattern = /top\s+\d+\s+(positive|negative)\s+emotions/i;
  
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
  
  const needsContext = /\bwhy\b|\breason\b|\bcause\b|\bexplain\b|\bunderstand\b|\bmeaning\b|\binterpret\b/.test(lowerQuery);
  
  return {
    isQuantitative: hasQuantitativeWords || hasNumbers || hasTopEmotionsPattern,
    
    isTemporal: hasTemporalWords,
    
    isComparative: hasComparativeWords || hasTopEmotionsPattern,
    
    isEmotionFocused: hasEmotionWords || hasTopEmotionsPattern,
    
    hasTopEmotionsPattern,
    
    needsContext: needsContext,
    
    asksForNumber: hasNumbers || hasTopEmotionsPattern || /how many|how much|what percentage|how often|frequency|count|number of/i.test(lowerQuery),
    
    needsVectorSearch: true
  };
};
