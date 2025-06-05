
/**
 * Query Complexity Analyzer for optimized processing strategy selection
 */

export interface QueryComplexityMetrics {
  wordCount: number;
  questionCount: number;
  entityCount: number;
  emotionCount: number;
  timeReferences: number;
  personalPronouns: number;
  complexityScore: number;
  complexityLevel: 'simple' | 'moderate' | 'complex' | 'very_complex';
  recommendedStrategy: 'fast_track' | 'standard' | 'comprehensive' | 'intelligent_orchestration';
}

export interface ComplexityThresholds {
  simple: number;
  moderate: number;
  complex: number;
}

const DEFAULT_THRESHOLDS: ComplexityThresholds = {
  simple: 15,
  moderate: 35,
  complex: 60
};

/**
 * Analyze query complexity to determine optimal processing strategy
 */
export function analyzeQueryComplexity(
  message: string,
  conversationContext: any[] = [],
  thresholds: ComplexityThresholds = DEFAULT_THRESHOLDS
): QueryComplexityMetrics {
  const lowerMessage = message.toLowerCase();
  const words = message.trim().split(/\s+/);
  
  // Basic metrics
  const wordCount = words.length;
  const questionCount = (message.match(/\?/g) || []).length;
  
  // Entity detection patterns
  const entityPatterns = [
    /\b(mom|dad|mother|father|parent|brother|sister|friend|colleague|boss|manager|doctor|teacher|partner|spouse|wife|husband)\b/gi,
    /\b(home|office|gym|restaurant|hospital|school|university|park|beach|store|mall|workplace|clinic)\b/gi,
    /\b(company|workplace|team|department|organization|clinic|hospital|school)\b/gi,
    /\b(meeting|appointment|party|wedding|conference|interview|vacation|trip|date|presentation)\b/gi
  ];
  
  let entityCount = 0;
  entityPatterns.forEach(pattern => {
    const matches = message.match(pattern) || [];
    entityCount += matches.length;
  });
  
  // Emotion detection patterns
  const emotionPatterns = [
    /\b(happy|happiness|joy|excited|elated|cheerful|delighted|joyful)\b/gi,
    /\b(sad|sadness|depressed|down|melancholy|grief|sorrow|upset)\b/gi,
    /\b(angry|anger|mad|furious|irritated|annoyed|frustrated|rage)\b/gi,
    /\b(anxious|anxiety|worried|nervous|stressed|panic|fear|fearful)\b/gi,
    /\b(love|loving|affection|caring|tender|devoted|adore)\b/gi,
    /\b(proud|pride|accomplished|confident|satisfied|achievement)\b/gi,
    /\b(grateful|thankful|appreciation|blessed|appreciative)\b/gi,
    /\b(disappointed|letdown|discouraged|dejected|frustrated)\b/gi,
    /\b(confused|uncertainty|bewildered|puzzled|uncertain)\b/gi,
    /\b(calm|peaceful|relaxed|serene|tranquil|content)\b/gi
  ];
  
  let emotionCount = 0;
  emotionPatterns.forEach(pattern => {
    const matches = message.match(pattern) || [];
    emotionCount += matches.length;
  });
  
  // Time reference detection
  const timePatterns = [
    /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night)\b/gi,
    /\b(last year|this year|next week|next month|tomorrow|soon|earlier|later)\b/gi,
    /\b(when|what time|how often|frequency|pattern|trend|over time)\b/gi
  ];
  
  let timeReferences = 0;
  timePatterns.forEach(pattern => {
    const matches = message.match(pattern) || [];
    timeReferences += matches.length;
  });
  
  // Personal pronoun detection
  const personalPronounPatterns = [
    /\b(i|me|my|mine|myself)\b/gi,
    /\bam i\b/gi,
    /\bdo i\b/gi,
    /\bhow am i\b/gi,
    /\bhow do i\b/gi,
    /\bwhat makes me\b/gi
  ];
  
  let personalPronouns = 0;
  personalPronounPatterns.forEach(pattern => {
    const matches = message.match(pattern) || [];
    personalPronouns += matches.length;
  });
  
  // Complexity indicators
  const complexityIndicators = [
    { pattern: /\b(analyze|analysis|pattern|trend|insight|correlation)\b/gi, weight: 8 },
    { pattern: /\b(top \d+|most common|most frequent)\b/gi, weight: 6 },
    { pattern: /\b(why|how|what causes|what makes)\b/gi, weight: 4 },
    { pattern: /\band\b/gi, weight: 2 },
    { pattern: /\balso\b/gi, weight: 2 },
    { pattern: /\bcompare|comparison\b/gi, weight: 5 },
    { pattern: /\brelationship|between\b/gi, weight: 4 },
    { pattern: /\bstatistics|stats|data\b/gi, weight: 6 }
  ];
  
  let complexityScore = 0;
  
  // Base score from word count
  complexityScore += Math.min(wordCount * 0.5, 15);
  
  // Question complexity
  complexityScore += questionCount * 3;
  
  // Entity and emotion complexity
  complexityScore += entityCount * 2;
  complexityScore += emotionCount * 2;
  
  // Time reference complexity
  complexityScore += timeReferences * 3;
  
  // Personal pronoun complexity (these often require comprehensive analysis)
  complexityScore += personalPronouns * 4;
  
  // Pattern-based complexity
  complexityIndicators.forEach(indicator => {
    const matches = message.match(indicator.pattern) || [];
    complexityScore += matches.length * indicator.weight;
  });
  
  // Conversation context complexity
  if (conversationContext.length > 0) {
    complexityScore += Math.min(conversationContext.length * 2, 10);
  }
  
  // Determine complexity level
  let complexityLevel: QueryComplexityMetrics['complexityLevel'];
  let recommendedStrategy: QueryComplexityMetrics['recommendedStrategy'];
  
  if (complexityScore <= thresholds.simple) {
    complexityLevel = 'simple';
    recommendedStrategy = 'fast_track';
  } else if (complexityScore <= thresholds.moderate) {
    complexityLevel = 'moderate';
    recommendedStrategy = 'standard';
  } else if (complexityScore <= thresholds.complex) {
    complexityLevel = 'complex';
    recommendedStrategy = 'comprehensive';
  } else {
    complexityLevel = 'very_complex';
    recommendedStrategy = 'intelligent_orchestration';
  }
  
  return {
    wordCount,
    questionCount,
    entityCount,
    emotionCount,
    timeReferences,
    personalPronouns,
    complexityScore,
    complexityLevel,
    recommendedStrategy
  };
}

/**
 * Get optimized search parameters based on complexity
 */
export function getOptimizedSearchParams(complexity: QueryComplexityMetrics) {
  switch (complexity.recommendedStrategy) {
    case 'fast_track':
      return {
        maxEntries: 5,
        searchTimeout: 2000,
        useVectorOnly: true,
        skipEntitySearch: true,
        skipEmotionAnalysis: false
      };
      
    case 'standard':
      return {
        maxEntries: 10,
        searchTimeout: 5000,
        useVectorOnly: false,
        skipEntitySearch: false,
        skipEmotionAnalysis: false
      };
      
    case 'comprehensive':
      return {
        maxEntries: 20,
        searchTimeout: 8000,
        useVectorOnly: false,
        skipEntitySearch: false,
        skipEmotionAnalysis: false
      };
      
    case 'intelligent_orchestration':
      return {
        maxEntries: 50,
        searchTimeout: 15000,
        useVectorOnly: false,
        skipEntitySearch: false,
        skipEmotionAnalysis: false
      };
      
    default:
      return {
        maxEntries: 10,
        searchTimeout: 5000,
        useVectorOnly: false,
        skipEntitySearch: false,
        skipEmotionAnalysis: false
      };
  }
}
