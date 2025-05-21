
/**
 * Utility functions for analyzing user queries and detecting their type
 */

import { detectRelativeTimeExpression, calculateRelativeDateRange, isRelativeTimeQuery } from './dateUtils';

export interface QueryTypes {
  isEmotionFocused: boolean;
  emotion: string | null;
  isQuantitative: boolean;
  isWhyQuestion: boolean;
  isPredictiveQuery: boolean;
  isRecommendationQuery: boolean;
  isTimePatternQuery: boolean;
  isTemporalQuery: boolean;
  isLocationalQuery: boolean;
  isPersonalInsightQuery: boolean;
  isMentalHealthQuery: boolean;
  needsDataAggregation: boolean; // Added missing property
  needsMoreContext: boolean;     // Added missing property
  emotion_keywords: string[];
  temporal_keywords: string[];
  timeRange: {
    periodName: string;
    duration: number;           // This property already exists but was not correctly typed
    startDate: string | null;
    endDate: string | null;
  };
}

/**
 * Analyze a query to determine various characteristics and intent
 */
export function analyzeQueryTypes(query: string): QueryTypes {
  const lowerQuery = query.toLowerCase();
  
  // Initialize result structure
  const result: QueryTypes = {
    isEmotionFocused: false,
    emotion: null,
    isQuantitative: false,
    isWhyQuestion: false,
    isPredictiveQuery: false,
    isRecommendationQuery: false,
    isTimePatternQuery: false,
    isTemporalQuery: false,
    isLocationalQuery: false,
    isPersonalInsightQuery: false,
    isMentalHealthQuery: false,
    needsDataAggregation: false, // Initialize new property
    needsMoreContext: false,     // Initialize new property
    emotion_keywords: [],
    temporal_keywords: [],
    timeRange: {
      periodName: 'recent',
      duration: 14, // Default to 2 weeks
      startDate: null,
      endDate: null
    }
  };
  
  // Check for emotion focus
  const emotionKeywords = [
    'happy', 'sad', 'angry', 'anxious', 'excited', 'worried', 
    'stressed', 'relaxed', 'frustrated', 'content', 'depressed',
    'overwhelmed', 'grateful', 'lonely', 'loved', 'afraid',
    'joy', 'sorrow', 'fear', 'disgust', 'surprise', 'trust',
    'anticipation', 'grief', 'remorse', 'jealousy', 'pride',
    'shame', 'guilt', 'envy', 'empathy', 'hope', 'despair',
    'mood', 'feeling', 'emotion', 'mental state', 'outlook'
  ];
  
  for (const keyword of emotionKeywords) {
    if (lowerQuery.includes(keyword)) {
      result.isEmotionFocused = true;
      result.emotion_keywords.push(keyword);
      
      // Set the primary emotion if not already set
      if (!result.emotion) {
        result.emotion = keyword;
      }
    }
  }
  
  // Check for quantitative indicators
  const quantitativePatterns = [
    /\bhow (much|many|often|frequently)\b/i,
    /\bcount\b/i,
    /\bnumber of\b/i,
    /\bpercent/i,
    /\bfrequency\b/i,
    /\baverage\b/i,
    /\brate\b/i
  ];
  
  result.isQuantitative = quantitativePatterns.some(pattern => pattern.test(lowerQuery));
  
  // Check for "why" questions
  result.isWhyQuestion = /\bwhy\b/i.test(lowerQuery);
  
  // Check for predictive queries
  const predictivePatterns = [
    /\bwill i\b/i,
    /\bam i going to\b/i,
    /\bin the future\b/i,
    /\bpredicti?/i,
    /\bforecast\b/i,
    /\bexpect\b/i
  ];
  
  result.isPredictiveQuery = predictivePatterns.some(pattern => pattern.test(lowerQuery));
  
  // Check for recommendation queries
  const recommendationPatterns = [
    /\b(what|how) should i\b/i,
    /\brecommend\b/i,
    /\bsuggest\b/i,
    /\badvice\b/i,
    /\btips\b/i,
    /\bideas\b/i
  ];
  
  result.isRecommendationQuery = recommendationPatterns.some(pattern => pattern.test(lowerQuery));
  
  // Check for time pattern queries - NEW!
  const timePatternPatterns = [
    /\bwhat time\b/i,
    /\bwhen do i\b/i,
    /\btime of day\b/i,
    /\b(morning|afternoon|evening|night)\b/i,
    /\bhow often\b/i,
    /\bfrequency\b/i,
    /\bdaily pattern\b/i,
    /\bschedule\b/i,
    /\broutine\b/i
  ];
  
  result.isTimePatternQuery = timePatternPatterns.some(pattern => pattern.test(lowerQuery)) && 
                              (lowerQuery.includes('journal') || lowerQuery.includes('entry') || lowerQuery.includes('log'));
  
  // Check for temporal queries
  const temporalKeywords = [
    'today', 'yesterday', 'tomorrow', 
    'week', 'month', 'year', 'decade',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 
    'july', 'august', 'september', 'october', 'november', 'december',
    'morning', 'afternoon', 'evening', 'night',
    'past', 'recent', 'lately', 'previous',
    'future', 'soon', 'upcoming', 'next',
    'day', 'date', 'time', 'period'
  ];
  
  for (const keyword of temporalKeywords) {
    if (lowerQuery.includes(keyword)) {
      result.isTemporalQuery = true;
      result.temporal_keywords.push(keyword);
    }
  }
  
  // Additional check for temporal patterns
  const temporalPatterns = [
    /\blast\s+\d+\s+(day|week|month|year)s?\b/i,
    /\bprevious\s+\d+\s+(day|week|month|year)s?\b/i,
    /\bpast\s+\d+\s+(day|week|month|year)s?\b/i,
    /\bnext\s+\d+\s+(day|week|month|year)s?\b/i,
    /\bcoming\s+\d+\s+(day|week|month|year)s?\b/i,
    /\bsince\s+\d+\s+(day|week|month|year)s?\b/i,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/i, // Date format MM/DD/YYYY or DD/MM/YYYY
    /\b\d{1,2}\-\d{1,2}\-\d{2,4}\b/i  // Date format MM-DD-YYYY or DD-MM-YYYY
  ];
  
  if (!result.isTemporalQuery) {
    result.isTemporalQuery = temporalPatterns.some(pattern => pattern.test(lowerQuery));
  }
  
  // Handle relative time expressions
  if (result.isTemporalQuery) {
    const timeExpression = detectRelativeTimeExpression(query);
    
    if (timeExpression) {
      // Calculate date range based on expression
      const { startDate, endDate, periodName, duration } = calculateRelativeDateRange(timeExpression);
      
      result.timeRange = {
        startDate,
        endDate,
        periodName,
        duration
      };
    }
  }
  
  // Check for locational queries
  const locationPatterns = [
    /\bwhere\b/i,
    /\blocation\b/i,
    /\bplace\b/i,
    /\bcountry\b/i,
    /\bcity\b/i,
    /\bregion\b/i,
    /\barea\b/i
  ];
  
  result.isLocationalQuery = locationPatterns.some(pattern => pattern.test(lowerQuery));
  
  // Check for personal insight queries
  const personalInsightPatterns = [
    /\binsight\b/i,
    /\bpattern\b/i,
    /\btrend\b/i,
    /\blearning\b/i,
    /\brealization\b/i,
    /\bunderstand\b/i,
    /\bawareness\b/i,
    /\bgrowth\b/i,
    /\bself[- ]discovery\b/i,
    /\bmy (personality|traits|character|nature)\b/i,
    /\bam i\b/i,
    /\bdo i\b/i,
    /\bhow (am|do) i\b/i
  ];
  
  result.isPersonalInsightQuery = personalInsightPatterns.some(pattern => pattern.test(lowerQuery)) ||
                                (/\bwhat\b/i.test(lowerQuery) && /\babout me\b/i.test(lowerQuery));
  
  // Check for mental health queries
  const mentalHealthPatterns = [
    /\b(mental health|wellbeing|wellness)\b/i,
    /\b(anxiety|depression|stress)\b/i,
    /\btherapy\b/i,
    /\bcounseling\b/i,
    /\bmedication\b/i,
    /\bdiagnosis\b/i,
    /\bsymptoms\b/i,
    /\bcoping\b/i,
    /\bself[- ]care\b/i,
    /\bmental\b/i,
    /\bemotional\b/i,
    /\bpsych(ological|iatric)\b/i
  ];
  
  result.isMentalHealthQuery = mentalHealthPatterns.some(pattern => pattern.test(lowerQuery));
  
  // Determine if this query needs data aggregation (like pattern analysis, statistics)
  result.needsDataAggregation = result.isQuantitative || 
                               result.isTimePatternQuery || 
                               /\bpattern\b|\btrend\b|\boverall\b|\bsummary\b|\banalyze\b|\banalysis\b/i.test(lowerQuery);
  
  // Determine if the query needs more context (vague or ambiguous)
  result.needsMoreContext = query.length < 10 || 
                          (/\bit\b|\bthat\b|\bthem\b|\bthose\b|\bthis\b/i.test(lowerQuery) && query.split(' ').length < 5);
  
  return result;
}
