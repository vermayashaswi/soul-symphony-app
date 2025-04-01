
// Change the return type to allow nested objects for properties like timeRange
export const analyzeQueryTypes = (query: string): Record<string, any> => {
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
    'dissatisfaction', 'delight', 'displeasure', 'anguish', 'bliss', 'happiness',
    'jovial', 'delighted', 'upbeat', 'jovial', 'merry', 'cheerful'
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
  const topEmotionsPattern = /(?:top|most|main|primary|strongest|highest|dominant)\s+(?:\d+|few|several)?\s*(?:positive|negative|intense|strong|happy|sad)?\s*(?:emotion|emotions|feeling|feelings)/i;
  
  // More lenient pattern that just detects "top emotions" or similar phrases
  const simpleTopEmotionsPattern = /(?:top|main|primary|most)\s+(?:emotion|emotions|feeling|feelings)/i;
  
  // Enhanced pattern detection for emotion ranking
  const emotionRankingPattern = /(?:rank|ranking|order|sort)\s+(?:of|my|the)?\s*(?:emotion|emotions|feeling|feelings)/i;
  
  // Enhanced pattern detection for emotion changes over time
  const emotionChangePattern = /(?:change|changes|changing|evolution|evolve|evolving|progress|progression|trend|trends|growth|development|shift|transition)\s+(?:in|of|my|the)?\s*(?:emotion|emotions|feeling|feelings)/i;
  
  // Enhanced detection for "when" questions that need temporal context
  const whenQuestionPattern = /\b(?:when|what time|which day|which month|which week|during what|during which)\b/i;
  
  // Enhanced detection for "why" questions about emotions
  const whyQuestionPattern = /\b(?:why|how come|reason|cause|what caused|what made|explain why)\b/i;
  
  // Check for specific emotion quantification patterns
  const emotionQuantificationPattern = /(?:how|what)\s+(?:much|level|degree|extent|intensity|amount)\s+(?:of|did|do|does|is|am|are|was|were)\s+(?:i|me|my|himself|herself|yourself|they|we|us|you)?\s*(?:feel|feeling|felt|experience|experienced|have|having|had|get|getting|got)\s+(?:a|an)?\s*(?:emotionWord)/i;
  
  // Special pattern for happiness rating
  const happinessRatingPattern = /(?:how|what)\s+(?:much|level|is|was|would you rate)\s+(?:rate|score|my)?\s+(?:my|the)?\s*(?:happiness|joy|content|satisfaction)(?:\s+(?:out of|level|score|rating))?\s*(?:\d+|percent|percentage)?/i;
  
  // New pattern for explicit happiness rating questions like "how much would you rate my happiness out of 100"
  const explicitHappinessRatingPattern = /(?:how|what).*(?:rate|score).*(?:happiness|joy|content|satisfaction).*(?:out of|from|between).*\d+/i;
  
  // New pattern for why questions about emotions
  const whyEmotionsPattern = /(?:why|reason|cause|what made).*(?:feel|emotion|mood)/i;
  
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
  
  // Enhanced pattern detection for relationship-related queries
  const relationshipPatterns = [
    /\b(?:partner|spouse|boyfriend|girlfriend|husband|wife|relationship|marriage|married)\b/i,
    /\b(?:fight|argue|conflict|disagreement|tension|problem)\b.*\b(?:partner|spouse|boyfriend|girlfriend|husband|wife)\b/i,
    /\b(?:partner|spouse|boyfriend|girlfriend|husband|wife)\b.*\b(?:fight|argue|conflict|disagreement|tension|problem)\b/i,
    /\b(?:improve|better|fix|work on|strengthen|enhance)\b.*\b(?:relationship|marriage|partner|spouse)\b/i
  ];
  
  // New pattern for "when" questions about specific events
  const whenEventPatterns = [
    /\bwhen\b.*\b(?:fight|argue|conflict|disagreement|fight with|argued with)\b/i,
    /\bwhen\b.*\b(?:happened|occurred|took place|was there)\b/i,
    /\bwhat time\b|\bwhich day\b|\bwhich date\b/i
  ];
  
  // Pattern for "how often" questions
  const frequencyPatterns = [
    /\bhow often\b|\bhow frequently\b|\bhow many times\b/i,
    /\bdo i (?:usually|regularly|often|frequently|commonly)\b/i,
    /\bam i (?:always|often|regularly|repeatedly)\b/i,
    /\bfrequency of\b|\brate of\b|\bpattern of\b/i
  ];
  
  // Pattern for improvement/advice questions
  const improvementPatterns = [
    /\bhow (?:can|could|should|do) i (?:improve|better|fix|work on|strengthen|enhance)\b/i,
    /\bwhat (?:can|could|should|do) i (?:do|try|practice) to (?:improve|better|fix)\b/i,
    /\b(?:improve|better|fix|enhance|strengthen)\b.*\b(?:how|ways|steps|methods)\b/i,
    /\b(?:advice|suggestion|recommendation|tip)\b.*\b(?:for|about|on)\b/i
  ];
  
  // Extract time range information
  const getTimeRange = (query: string): { timeframeType: string | null, startDate: Date | null, endDate: Date | null } => {
    const lowerQuery = query.toLowerCase();
    const now = new Date();
    
    if (lowerQuery.includes('last month') || lowerQuery.includes('previous month')) {
      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
      const endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
      return { timeframeType: 'month', startDate, endDate };
    } 
    else if (lowerQuery.includes('this month') || lowerQuery.includes('current month')) {
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { timeframeType: 'month', startDate, endDate };
    }
    else if (lowerQuery.includes('last week') || lowerQuery.includes('previous week')) {
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const dayOfWeek = lastWeek.getDay(); // 0 is Sunday, 6 is Saturday
      const startDate = new Date(lastWeek);
      startDate.setDate(lastWeek.getDate() - dayOfWeek);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      return { timeframeType: 'week', startDate, endDate };
    }
    else if (lowerQuery.includes('this week') || lowerQuery.includes('current week')) {
      const dayOfWeek = now.getDay();
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      return { timeframeType: 'week', startDate, endDate };
    }
    else if (lowerQuery.includes('yesterday')) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const endDate = new Date(yesterday);
      endDate.setHours(23, 59, 59, 999);
      return { timeframeType: 'day', startDate: yesterday, endDate };
    }
    else if (lowerQuery.includes('today')) {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      return { timeframeType: 'day', startDate: today, endDate };
    }
    else if (lowerQuery.includes('last year') || lowerQuery.includes('previous year')) {
      const lastYear = now.getFullYear() - 1;
      const startDate = new Date(lastYear, 0, 1);
      const endDate = new Date(lastYear, 11, 31);
      return { timeframeType: 'year', startDate, endDate };
    }
    
    // Default to null if no specific timeframe is detected
    return { timeframeType: null, startDate: null, endDate: null };
  };
  
  // Check for relationship-related queries
  const isRelationshipQuery = relationshipPatterns.some(pattern => 
    pattern.test(lowerQuery)
  );
  
  // Check for "when" event questions
  const isWhenEventQuery = whenEventPatterns.some(pattern => 
    pattern.test(lowerQuery)
  );
  
  // Check for frequency questions
  const isFrequencyQuery = frequencyPatterns.some(pattern => 
    pattern.test(lowerQuery)
  );
  
  // Check for improvement/advice questions
  const isImprovementQuery = improvementPatterns.some(pattern => 
    pattern.test(lowerQuery)
  );
  
  // Check for specific emotion quantification patterns
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
  
  const hasTopEmotionsPattern = topEmotionsPattern.test(lowerQuery) || simpleTopEmotionsPattern.test(lowerQuery);
  const hasEmotionRankingPattern = emotionRankingPattern.test(lowerQuery);
  const hasEmotionChangePattern = emotionChangePattern.test(lowerQuery);
  const isWhenQuestion = whenQuestionPattern.test(lowerQuery);
  const isWhyQuestion = whyQuestionPattern.test(lowerQuery);
  const hasWhyEmotionsPattern = whyEmotionsPattern.test(lowerQuery);
  
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
                              (hasEmotionWords && hasWhyEmotionsPattern) ||
                              (hasEmotionWords && (hasQuantitativeWords || hasNumbers || hasComparativeWords));
  
  // Determine if vector search is needed
  const needsVectorSearch = needsContext || 
                           isWhyQuestion ||
                           hasWhyEmotionsPattern || 
                           (isComplexQuery && !hasTopEmotionsPattern);
  
  // Extract time range
  const timeRange = getTimeRange(query);
  
  // Set the emotion focused flag so we can use it in the search strategy
  const isEmotionFocused = hasEmotionWords || hasTopEmotionsPattern || hasEmotionRankingPattern || hasEmotionQuantification || hasHappinessRating;
  
  // Set the temporal flag for use in the search strategy
  const isTemporal = hasTemporalWords;
  
  // Enhanced search strategy determination
  const determineSearchStrategy = () => {
    if (isWhenEventQuery) {
      return 'temporal_vector_search';
    } 
    if (isFrequencyQuery) {
      return 'frequency_analysis';
    }
    if (isImprovementQuery) {
      return 'contextual_advice';
    }
    if (hasTopEmotionsPattern) {
      return 'emotion_aggregation';
    }
    if (isEmotionFocused && isWhyQuestion) {
      return 'emotion_causal_analysis';
    }
    if (isRelationshipQuery && (isWhyQuestion || needsContext)) {
      return 'relationship_analysis';
    }
    if (needsDataAggregation) {
      return 'data_aggregation';
    }
    return 'vector_search';
  };
  
  const hasExplicitHappinessRating = explicitHappinessRatingPattern.test(lowerQuery);
  
  return {
    isQuantitative: hasQuantitativeWords || hasNumbers || hasTopEmotionsPattern || hasEmotionQuantification || hasHappinessRating,
    
    isTemporal: hasTemporalWords,
    
    isComparative: hasComparativeWords || hasTopEmotionsPattern || hasEmotionChangePattern,
    
    isEmotionFocused,
    
    hasTopEmotionsPattern,
    
    hasEmotionRankingPattern,
    
    hasEmotionChangePattern,
    
    hasEmotionQuantification,
    
    hasHappinessRating,
    
    isWhenQuestion,
    
    isWhyQuestion,
    
    needsContext,
    
    needsDataAggregation,
    
    isComplexQuery,
    
    hasExplicitHappinessRating,
    
    requiresComponentAnalysis: isComplexQuery || hasHappinessRating || hasTopEmotionsPattern || hasWhyEmotionsPattern || 
                              (hasTemporalWords && hasEmotionWords && hasQuantitativeWords),
    
    asksForNumber: hasNumbers || hasTopEmotionsPattern || hasHappinessRating || /how many|how much|what percentage|how often|frequency|count|number of/i.test(lowerQuery),
    
    needsVectorSearch: needsVectorSearch,
    
    hasWhyEmotionsPattern,
    
    isRelationshipQuery,
    isWhenEventQuery,
    isFrequencyQuery,
    isImprovementQuery,
    
    searchStrategy: determineSearchStrategy(),
    needsTimeRetrieval: isWhenEventQuery || (isRelationshipQuery && isTemporal),
    needsThemeFiltering: isRelationshipQuery || isImprovementQuery,
    
    timeRange: {
      type: timeRange.timeframeType,
      startDate: timeRange.startDate ? timeRange.startDate.toISOString() : null,
      endDate: timeRange.endDate ? timeRange.endDate.toISOString() : null
    }
  };
};
