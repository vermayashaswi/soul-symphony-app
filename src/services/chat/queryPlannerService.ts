
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";

export type SearchStrategy = 'vector' | 'theme' | 'emotion' | 'time' | 'hybrid' | 'sql';

export interface QueryPlan {
  searchStrategy: SearchStrategy;
  themeTerms?: string[];
  emotionTerms?: string[];
  timeRange?: {
    startDate: string | null;
    endDate: string | null;
    periodName: string;
  };
  expandedThemes?: string[];
  expandedEmotions?: string[];
  needsDataAggregation: boolean;
  needsMoreContext: boolean;
  matchCount: number;
  isSegmented?: boolean;
  subqueries?: string[];
}

const FITNESS_RELATED_TERMS = [
  'fit', 'fitness', 'exercise', 'workout', 'gym', 'run', 'running', 'jog', 'jogging', 
  'training', 'health', 'physical', 'strength', 'cardio', 'sport', 'sports', 'active',
  'activity', 'walk', 'walking', 'cycling', 'bike', 'biking', 'weight', 'weights', 
  'swimming', 'swim', 'yoga', 'pilates'
];

const HEALTH_RELATED_TERMS = [
  'health', 'healthy', 'diet', 'nutrition', 'sleep', 'rest', 'energy', 'fatigue',
  'tired', 'exhausted', 'wellness', 'well-being', 'wellbeing', 'recovery'
];

const EMOTION_CATEGORIES = {
  positive: ['happy', 'joy', 'excited', 'enthusiastic', 'proud', 'satisfied', 'content', 'peaceful'],
  negative: ['sad', 'frustrated', 'angry', 'anxious', 'worried', 'stressed', 'afraid', 'depressed'],
  neutral: ['calm', 'curious', 'surprised', 'confused', 'uncertain', 'reflective', 'thoughtful']
};

/**
 * Expands a theme term into related terms to improve search coverage
 */
export function expandThemeTerms(themes: string[]): string[] {
  const expandedTerms = [...themes];
  
  // For each theme, add related terms
  themes.forEach(theme => {
    const themeLower = theme.toLowerCase();
    
    // Fitness theme expansion
    if (FITNESS_RELATED_TERMS.some(term => themeLower.includes(term))) {
      FITNESS_RELATED_TERMS.forEach(term => {
        if (!expandedTerms.includes(term)) {
          expandedTerms.push(term);
        }
      });
    }
    
    // Health theme expansion
    if (HEALTH_RELATED_TERMS.some(term => themeLower.includes(term))) {
      HEALTH_RELATED_TERMS.forEach(term => {
        if (!expandedTerms.includes(term)) {
          expandedTerms.push(term);
        }
      });
    }
    
    // Add more theme expansions as needed...
  });
  
  return expandedTerms;
}

/**
 * Extracts theme terms from the query
 */
function extractThemeTerms(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const themeTerms: string[] = [];
  
  // Check for fitness and health related terms
  FITNESS_RELATED_TERMS.forEach(term => {
    if (lowerQuery.includes(term)) {
      themeTerms.push(term);
    }
  });
  
  HEALTH_RELATED_TERMS.forEach(term => {
    if (lowerQuery.includes(term)) {
      themeTerms.push(term);
    }
  });
  
  // Extract themes from "about X", "regarding X" patterns
  const aboutPatterns = [
    /about\s+(\w+)/i,
    /regarding\s+(\w+)/i,
    /related to\s+(\w+)/i,
    /on\s+(\w+)/i,
    /my\s+(\w+)/i
  ];
  
  aboutPatterns.forEach(pattern => {
    const match = lowerQuery.match(pattern);
    if (match && match[1] && match[1].length > 2) { // Avoid short words
      themeTerms.push(match[1]);
    }
  });
  
  return [...new Set(themeTerms)]; // Remove duplicates
}

/**
 * Extracts emotion terms from the query
 */
function extractEmotionTerms(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const emotionTerms: string[] = [];
  
  // Check all emotion categories
  Object.values(EMOTION_CATEGORIES).flat().forEach(emotion => {
    if (lowerQuery.includes(emotion)) {
      emotionTerms.push(emotion);
    }
  });
  
  return [...new Set(emotionTerms)]; // Remove duplicates
}

/**
 * Converts a GPT-generated plan to our internal QueryPlan format
 */
export function convertGptPlanToQueryPlan(gptPlan: any): QueryPlan {
  if (!gptPlan) {
    return createLegacyQueryPlan(''); // Return default plan
  }

  try {
    // Map GPT strategy to our SearchStrategy
    let searchStrategy: SearchStrategy = 'vector';
    if (gptPlan.strategy) {
      switch(gptPlan.strategy.toLowerCase()) {
        case 'vector': 
          searchStrategy = 'vector'; 
          break;
        case 'sql': 
          searchStrategy = 'vector'; // We don't have direct SQL yet, so map to vector
          break;
        case 'hybrid': 
          searchStrategy = 'hybrid'; 
          break;
        case 'emotion': 
          searchStrategy = 'emotion'; 
          break;
        case 'time': 
          searchStrategy = 'time'; 
          break;
        case 'theme':
          searchStrategy = 'theme';
          break;
      }
    }

    // Extract filters
    const themeTerms = gptPlan.filters?.themes || [];
    const emotionTerms = gptPlan.filters?.emotions || [];
    
    // Set up time range if provided
    let timeRange = undefined;
    if (gptPlan.filters?.date_range) {
      timeRange = {
        startDate: gptPlan.filters.date_range.startDate || null,
        endDate: gptPlan.filters.date_range.endDate || null,
        periodName: gptPlan.filters.date_range.periodName || ''
      };
    }
    
    // Create our query plan
    const queryPlan: QueryPlan = {
      searchStrategy,
      needsDataAggregation: gptPlan.needs_data_aggregation || false,
      needsMoreContext: gptPlan.needs_more_context || false,
      matchCount: gptPlan.match_count || 15,
      isSegmented: gptPlan.is_segmented || false,
      subqueries: gptPlan.subqueries || []
    };
    
    // Add theme terms and expanded terms if found
    if (themeTerms.length > 0) {
      queryPlan.themeTerms = themeTerms;
      queryPlan.expandedThemes = expandThemeTerms(themeTerms);
    }
    
    // Add emotion terms if found
    if (emotionTerms.length > 0) {
      queryPlan.emotionTerms = emotionTerms;
    }
    
    // Add time range if found
    if (timeRange) {
      queryPlan.timeRange = timeRange;
    }
    
    return queryPlan;
  } catch (error) {
    console.error("Error converting GPT plan to query plan:", error);
    return createLegacyQueryPlan(''); // Return default plan
  }
}

/**
 * Creates a legacy query plan based on the user's question (used as fallback)
 */
export function createLegacyQueryPlan(query: string): QueryPlan {
  const queryTypes = analyzeQueryTypes(query);
  const themeTerms = extractThemeTerms(query);
  const emotionTerms = extractEmotionTerms(query);
  
  // Default plan uses vector search
  const plan: QueryPlan = {
    searchStrategy: 'vector',
    needsDataAggregation: queryTypes.needsDataAggregation,
    needsMoreContext: queryTypes.needsMoreContext,
    matchCount: 20 // Increase from default 10
  };
  
  // Add theme terms and expanded terms if found
  if (themeTerms.length > 0) {
    plan.themeTerms = themeTerms;
    plan.expandedThemes = expandThemeTerms(themeTerms);
    plan.searchStrategy = 'theme';
  }
  
  // Add emotion terms if found
  if (emotionTerms.length > 0) {
    plan.emotionTerms = emotionTerms;
    // If we have both themes and emotions, use hybrid search
    if (themeTerms.length > 0) {
      plan.searchStrategy = 'hybrid';
    } else {
      plan.searchStrategy = 'emotion';
    }
  }
  
  // Time-based search takes precedence if time is specified
  if (queryTypes.isTemporalQuery || queryTypes.isTimePatternQuery || queryTypes.isWhenQuestion) {
    plan.timeRange = queryTypes.timeRange;
    
    // If we have time + theme/emotion, still use hybrid
    if (plan.searchStrategy === 'theme' || plan.searchStrategy === 'emotion') {
      plan.searchStrategy = 'hybrid';
    } else if (plan.searchStrategy !== 'hybrid') {
      plan.searchStrategy = 'time';
    }
  }
  
  // Set a higher match count for aggregation queries
  if (queryTypes.needsDataAggregation || 
      plan.searchStrategy === 'hybrid' || 
      query.toLowerCase().includes('all') || 
      query.toLowerCase().includes('every')) {
    plan.matchCount = 30; // Return more entries for comprehensive analysis
  }
  
  return plan;
}

/**
 * Creates an intelligent query plan based on the user's question
 * This function is kept for backward compatibility
 */
export function createQueryPlan(query: string): QueryPlan {
  return createLegacyQueryPlan(query);
}
