
// Local queryAnalyzer module for the chat-with-rag function

export interface QueryTypes {
  isEmotionFocused: boolean;
  isThemeFocused: boolean;
  isQuantitative: boolean;
  needsVectorSearch: boolean;
  needsDataAggregation: boolean;
  isTimeFocused: boolean;
  isWhyQuestion: boolean;
  isHowQuestion: boolean;
  isWhatQuestion: boolean;
  isComparison: boolean;
  isPersonFocused: boolean;
  isFrequencyFocused: boolean;
  isEntityFocused: boolean;
  targetTimeRange: {
    type: string | null;
    startDate: string | null;
    endDate: string | null;
  };
}

export function analyzeQueryTypes(query: string): QueryTypes {
  // Normalize the query to lowercase for easier pattern matching
  const normalizedQuery = query.toLowerCase();
  
  // Initialize the analysis object
  const analysis: QueryTypes = {
    isEmotionFocused: false,
    isThemeFocused: false,  
    isQuantitative: false,
    needsVectorSearch: true, // Default to true as most queries benefit from semantic search
    needsDataAggregation: false,
    isTimeFocused: false,
    isWhyQuestion: false,
    isHowQuestion: false,
    isWhatQuestion: false,
    isComparison: false,
    isPersonFocused: false,
    isFrequencyFocused: false,
    isEntityFocused: false,
    targetTimeRange: {
      type: null,
      startDate: null,
      endDate: null
    }
  };
  
  // Check for emotion-related keywords
  const emotionKeywords = [
    'feel', 'feeling', 'felt', 'emotion', 'emotional', 'mood', 'happy', 'sad', 
    'angry', 'upset', 'joy', 'joyful', 'depressed', 'anxious', 'anxiety', 'stress', 
    'stressed', 'worried', 'fear', 'scared', 'excited', 'calm', 'peaceful', 'love',
    'loved', 'hate', 'hated', 'frustrated', 'content', 'satisfaction', 'dissatisfaction',
    'positive', 'negative', 'neutral', 'sentiment'
  ];
  
  analysis.isEmotionFocused = emotionKeywords.some(keyword => 
    normalizedQuery.includes(keyword));
  
  // Check for theme-related patterns
  const themePatterns = [
    'theme', 'topic', 'subject', 'about', 'regarding', 'related to', 'concerning',
    'mention of', 'talking about', 'wrote about', 'journaled about', 'recurring',
    'pattern', 'consistent', 'regularly', 'common'
  ];
  
  analysis.isThemeFocused = themePatterns.some(pattern => 
    normalizedQuery.includes(pattern));
  
  // Check for quantitative analysis patterns
  const quantitativePatterns = [
    'how many', 'how much', 'count', 'number of', 'frequency', 'times', 'often',
    'percentage', 'most', 'least', 'average', 'mean', 'median', 'total', 'sum',
    'statistics', 'stats', 'trend', 'increase', 'decrease', 'change', 'rate',
    'top', 'bottom', 'ranked', 'ranking', 'weekly', 'monthly', 'daily', 'yearly'
  ];
  
  analysis.isQuantitative = quantitativePatterns.some(pattern => 
    normalizedQuery.includes(pattern));
  
  // Check if the query needs data aggregation
  const aggregationPatterns = [
    'all', 'every', 'total', 'combined', 'overall', 'summary', 'summarize',
    'average', 'mean', 'trend', 'across', 'throughout', 'entire', 'whole',
    'complete', 'most', 'least', 'frequently', 'rarely', 'never', 'always',
    'maximum', 'minimum', 'highest', 'lowest', 'peak', 'valley', 'aggregate'
  ];
  
  analysis.needsDataAggregation = aggregationPatterns.some(pattern => 
    normalizedQuery.includes(pattern)) || analysis.isQuantitative;
  
  // Check for time-related patterns
  const timePatterns = [
    'yesterday', 'today', 'this morning', 'this afternoon', 'this evening',
    'last night', 'last week', 'last month', 'last year', 'past week',
    'past month', 'past year', 'recent', 'recently', 'latest', 'newest',
    'oldest', 'earlier', 'later', 'before', 'after', 'during', 'between',
    'from', 'to', 'until', 'since', 'previous', 'next', 'upcoming', 'future',
    'schedule', 'date', 'time', 'period', 'duration', 'interval', 'monday',
    'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr',
    'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];
  
  analysis.isTimeFocused = timePatterns.some(pattern => 
    normalizedQuery.includes(pattern));
  
  // Detect specific question types
  analysis.isWhyQuestion = /\bwhy\b/.test(normalizedQuery);
  analysis.isHowQuestion = /\bhow\b/.test(normalizedQuery) && 
    !/\bhow many\b/.test(normalizedQuery) && 
    !/\bhow much\b/.test(normalizedQuery);
  analysis.isWhatQuestion = /\bwhat\b/.test(normalizedQuery);
  
  // Check for comparison patterns
  const comparisonPatterns = [
    'than', 'compared to', 'versus', 'vs', 'vs.', 'comparison', 'compare',
    'difference', 'different', 'similar', 'similarity', 'same as', 'like',
    'unlike', 'more', 'less', 'better', 'worse', 'higher', 'lower', 'bigger',
    'smaller', 'stronger', 'weaker', 'prefer', 'preference'
  ];
  
  analysis.isComparison = comparisonPatterns.some(pattern => 
    normalizedQuery.includes(pattern));
  
  // Check for person-focused patterns
  const personPatterns = [
    'who', 'person', 'people', 'friend', 'family', 'relative', 'parent', 'child',
    'mother', 'father', 'sister', 'brother', 'partner', 'spouse', 'husband', 'wife',
    'colleague', 'coworker', 'boss', 'manager', 'supervisor', 'employee', 'student',
    'teacher', 'professor', 'doctor', 'nurse', 'therapist', 'counselor', 'neighbor'
  ];
  
  analysis.isPersonFocused = personPatterns.some(pattern => 
    normalizedQuery.includes(pattern));
  
  // Check for frequency patterns
  const frequencyPatterns = [
    'often', 'frequently', 'regularly', 'occasionally', 'sometimes', 'rarely',
    'seldom', 'never', 'always', 'usually', 'generally', 'typically', 'commonly',
    'consistently', 'intermittently', 'periodically', 'constantly', 'continuously',
    'habitually', 'routinely', 'every day', 'every week', 'every month', 'daily',
    'weekly', 'monthly', 'yearly', 'annually', 'biweekly', 'bimonthly', 'quarterly'
  ];
  
  analysis.isFrequencyFocused = frequencyPatterns.some(pattern => 
    normalizedQuery.includes(pattern));
  
  // Check for entity focus
  const entityPatterns = [
    'location', 'place', 'where', 'city', 'country', 'restaurant', 'store', 'shop',
    'organization', 'company', 'business', 'institution', 'school', 'university',
    'hospital', 'clinic', 'event', 'meeting', 'appointment', 'party', 'celebration',
    'object', 'item', 'possession', 'property', 'product', 'brand', 'model'
  ];
  
  analysis.isEntityFocused = entityPatterns.some(pattern => 
    normalizedQuery.includes(pattern)) || analysis.isPersonFocused;
  
  // Identify time range if time-focused
  if (analysis.isTimeFocused) {
    // Check for today
    if (normalizedQuery.includes('today') || normalizedQuery.includes('this day')) {
      analysis.targetTimeRange.type = 'today';
    }
    // Check for yesterday
    else if (normalizedQuery.includes('yesterday')) {
      analysis.targetTimeRange.type = 'yesterday';
    }
    // Check for this week
    else if (normalizedQuery.includes('this week') || normalizedQuery.includes('current week')) {
      analysis.targetTimeRange.type = 'week';
    }
    // Check for last week
    else if (normalizedQuery.includes('last week') || normalizedQuery.includes('previous week')) {
      analysis.targetTimeRange.type = 'lastWeek';
    }
    // Check for this month
    else if (normalizedQuery.includes('this month') || normalizedQuery.includes('current month')) {
      analysis.targetTimeRange.type = 'month';
    }
    // Check for last month
    else if (normalizedQuery.includes('last month') || normalizedQuery.includes('previous month')) {
      analysis.targetTimeRange.type = 'lastMonth';
    }
    // Check for this year
    else if (normalizedQuery.includes('this year') || normalizedQuery.includes('current year')) {
      analysis.targetTimeRange.type = 'year';
    }
    // Check for last year
    else if (normalizedQuery.includes('last year') || normalizedQuery.includes('previous year')) {
      analysis.targetTimeRange.type = 'lastYear';
    }
    // Check for recent/lately (default to last 7 days)
    else if (normalizedQuery.includes('recent') || normalizedQuery.includes('recently') || 
              normalizedQuery.includes('lately')) {
      analysis.targetTimeRange.type = 'recent';
    }
  }
  
  return analysis;
}
