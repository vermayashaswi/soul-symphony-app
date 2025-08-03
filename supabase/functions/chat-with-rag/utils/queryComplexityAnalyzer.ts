/**
 * Query Complexity Analyzer for optimized async processing
 */

export interface QueryComplexityMetrics {
  wordCount: number;
  questionCount: number;
  entityCount: number;
  emotionCount: number;
  timeReferences: number;
  personalPronouns: number;
  complexityScore: number;
  complexityLevel: 'simple' | 'moderate' | 'complex';
  recommendedStrategy: 'fast_track' | 'standard' | 'comprehensive';
}

/**
 * Analyze query complexity to determine optimal async processing strategy
 */
export function analyzeQueryComplexity(
  message: string,
  conversationContext: any[] = [],
  queryPlan: any = null
): 'simple' | 'moderate' | 'complex' {
  const lowerMessage = message.toLowerCase();
  const words = message.trim().split(/\s+/);
  
  let complexityScore = 0;
  
  // Base score from word count
  complexityScore += Math.min(words.length * 0.5, 10);
  
  // Question complexity
  const questionCount = (message.match(/\?/g) || []).length;
  complexityScore += questionCount * 2;
  
  // Personal pronoun complexity (requires comprehensive analysis)
  const personalPronouns = /\b(i|me|my|mine|myself|am i|do i|how am i)\b/gi.test(lowerMessage);
  if (personalPronouns) complexityScore += 8;
  
  // Time reference complexity
  const timeReferences = /\b(last week|yesterday|this week|last month|today|recently|lately)\b/gi.test(lowerMessage);
  if (timeReferences) complexityScore += 6;
  
  // Analytical query indicators
  const analyticalIndicators = [
    /\b(analyze|analysis|pattern|trend|insight|correlation)\b/gi,
    /\b(top \d+|most common|most frequent)\b/gi,
    /\b(why|how|what causes|what makes)\b/gi,
    /\b(compare|comparison|relationship|between)\b/gi,
    /\b(statistics|stats|data|breakdown)\b/gi
  ];
  
  analyticalIndicators.forEach(pattern => {
    if (pattern.test(message)) complexityScore += 5;
  });
  
  // Emotion/theme complexity
  const emotionCount = /\b(emotion|feel|mood|happy|sad|anxious|stressed|angry|excited)\b/gi.test(lowerMessage);
  if (emotionCount) complexityScore += 4;
  
  // Entity complexity
  const entityCount = /\b(work|family|friend|relationship|health|goal|travel)\b/gi.test(lowerMessage);
  if (entityCount) complexityScore += 3;
  
  // Conversation context complexity
  if (conversationContext.length > 2) {
    complexityScore += Math.min(conversationContext.length, 5);
  }
  
  // Query plan complexity
  if (queryPlan) {
    if (queryPlan.searchConfidence < 0.6) complexityScore += 8;
    if (queryPlan.strategy === 'intelligent_sub_query') complexityScore += 4;
    if (queryPlan.subQuestions && queryPlan.subQuestions.length > 2) complexityScore += 6;
  }
  
  // Determine complexity level
  if (complexityScore <= 15) {
    return 'simple';
  } else if (complexityScore <= 35) {
    return 'moderate';
  } else {
    return 'complex';
  }
}

/**
 * Get optimized search parameters based on complexity
 */
export function getOptimizedSearchParams(complexity: 'simple' | 'moderate' | 'complex') {
  switch (complexity) {
    case 'simple':
      return {
        maxEntries: 8,
        searchTimeout: 2000,
        useVectorOnly: true,
        skipEntitySearch: true,
        skipEmotionAnalysis: false,
        parallelSearches: 1
      };
      
    case 'moderate':
      return {
        maxEntries: 15,
        searchTimeout: 5000,
        useVectorOnly: false,
        skipEntitySearch: false,
        skipEmotionAnalysis: false,
        parallelSearches: 2
      };
      
    case 'complex':
      return {
        maxEntries: 25,
        searchTimeout: 8000,
        useVectorOnly: false,
        skipEntitySearch: false,
        skipEmotionAnalysis: false,
        parallelSearches: 4
      };
      
    default:
      return {
        maxEntries: 15,
        searchTimeout: 5000,
        useVectorOnly: false,
        skipEntitySearch: false,
        skipEmotionAnalysis: false,
        parallelSearches: 2
      };
  }
}