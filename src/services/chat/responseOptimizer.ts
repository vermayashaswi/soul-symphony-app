/**
 * Phase 2: Context-aware response sizing and conversational flow awareness
 * Phase 4: Response length intelligence and emotional intelligence
 */

export interface ResponseOptimizationConfig {
  maxLength: number;
  minLength: number;
  preferredStyle: 'concise' | 'detailed' | 'analytical' | 'conversational';
  emotionalTone: 'supportive' | 'analytical' | 'encouraging' | 'neutral';
  includeExamples: boolean;
  includeActionables: boolean;
  formatForMobile: boolean;
}

export interface ConversationalFlowContext {
  isFirstMessage: boolean;
  isFollowUp: boolean;
  previousTopics: string[];
  userEngagementLevel: 'high' | 'medium' | 'low';
  conversationDepth: number;
  lastResponseType: 'analytical' | 'supportive' | 'informational';
}

export function optimizeResponseLength(
  baseResponse: string,
  queryComplexity: 'simple' | 'moderate' | 'complex' | 'very_complex',
  conversationalFlow: ConversationalFlowContext,
  userPreferences?: { prefersBrief?: boolean; prefersDetailed?: boolean }
): ResponseOptimizationConfig {
  
  // Phase 2: Context-aware response sizing
  let config: ResponseOptimizationConfig = {
    maxLength: 400,
    minLength: 100,
    preferredStyle: 'conversational',
    emotionalTone: 'supportive',
    includeExamples: false,
    includeActionables: false,
    formatForMobile: true
  };

  // Adjust based on query complexity
  switch (queryComplexity) {
    case 'simple':
      config.maxLength = 250;
      config.minLength = 50;
      config.preferredStyle = 'concise';
      config.includeExamples = false;
      break;
      
    case 'moderate':
      config.maxLength = 400;
      config.minLength = 100;
      config.preferredStyle = 'conversational';
      config.includeExamples = true;
      break;
      
    case 'complex':
      config.maxLength = 600;
      config.minLength = 200;
      config.preferredStyle = 'detailed';
      config.includeExamples = true;
      config.includeActionables = true;
      break;
      
    case 'very_complex':
      config.maxLength = 800;
      config.minLength = 300;
      config.preferredStyle = 'analytical';
      config.includeExamples = true;
      config.includeActionables = true;
      break;
  }

  // Phase 2: Conversational flow awareness
  if (conversationalFlow.isFirstMessage) {
    config.emotionalTone = 'encouraging';
    config.maxLength += 100; // Be more welcoming
  }

  if (conversationalFlow.isFollowUp && conversationalFlow.conversationDepth > 3) {
    config.preferredStyle = 'concise';
    config.maxLength -= 100; // Shorter responses in deep conversations
  }

  if (conversationalFlow.userEngagementLevel === 'low') {
    config.maxLength = Math.min(config.maxLength, 300);
    config.preferredStyle = 'concise';
    config.emotionalTone = 'encouraging';
  }

  // User preference overrides
  if (userPreferences?.prefersBrief) {
    config.maxLength = Math.min(config.maxLength, 300);
    config.preferredStyle = 'concise';
  }

  if (userPreferences?.prefersDetailed) {
    config.maxLength = Math.max(config.maxLength, 500);
    config.preferredStyle = 'detailed';
  }

  return config;
}

// Phase 4: Emotional intelligence for response adaptation
export function analyzeEmotionalContext(
  userMessage: string,
  journalEntryEmotions: Record<string, number>,
  conversationHistory: any[]
): {
  primaryEmotion: string;
  emotionalIntensity: number;
  needsSupport: boolean;
  suggestedTone: 'gentle' | 'encouraging' | 'analytical' | 'celebratory';
  sensitiveTopics: string[];
} {
  const lowerMessage = userMessage.toLowerCase();
  
  // Detect emotional intensity from message
  const highIntensityWords = ['extremely', 'very', 'really', 'so', 'absolutely', 'completely'];
  const emotionalIntensity = highIntensityWords.filter(word => 
    lowerMessage.includes(word)
  ).length * 0.2;

  // Detect if user needs emotional support
  const supportIndicators = ['struggling', 'difficult', 'hard', 'overwhelmed', 'stressed', 'anxious', 'sad', 'worried'];
  const needsSupport = supportIndicators.some(indicator => lowerMessage.includes(indicator));

  // Find primary emotion from journal data
  let primaryEmotion = 'neutral';
  if (journalEntryEmotions) {
    primaryEmotion = Object.entries(journalEntryEmotions)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral';
  }

  // Suggest tone based on context
  let suggestedTone: 'gentle' | 'encouraging' | 'analytical' | 'celebratory' = 'encouraging';
  
  if (needsSupport || ['sad', 'anxious', 'stressed'].includes(primaryEmotion)) {
    suggestedTone = 'gentle';
  } else if (['happy', 'excited', 'proud'].includes(primaryEmotion)) {
    suggestedTone = 'celebratory';
  } else if (lowerMessage.includes('analyze') || lowerMessage.includes('data') || lowerMessage.includes('pattern')) {
    suggestedTone = 'analytical';
  }

  // Identify sensitive topics that need careful handling
  const sensitiveTopics = [];
  const sensitivePatterns = {
    'relationships': /relationship|partner|breakup|divorce|dating/i,
    'health': /health|sick|illness|medical|doctor/i,
    'work': /work|job|career|boss|colleague/i,
    'family': /family|parent|mother|father|sibling/i,
    'self-worth': /worth|value|confidence|self-esteem/i
  };

  for (const [topic, pattern] of Object.entries(sensitivePatterns)) {
    if (pattern.test(userMessage)) {
      sensitiveTopics.push(topic);
    }
  }

  return {
    primaryEmotion,
    emotionalIntensity: Math.min(emotionalIntensity, 1.0),
    needsSupport,
    suggestedTone,
    sensitiveTopics
  };
}

// Phase 4: Conversational pattern recognition
export function detectConversationalPattern(
  conversationHistory: any[]
): {
  pattern: 'exploration' | 'problem_solving' | 'reflection' | 'crisis' | 'progress_tracking';
  confidence: number;
  suggestedDirection: string;
} {
  if (conversationHistory.length < 2) {
    return {
      pattern: 'exploration',
      confidence: 0.5,
      suggestedDirection: 'Continue exploring their thoughts and feelings'
    };
  }

  const recentMessages = conversationHistory.slice(-5).map(msg => msg.content.toLowerCase());
  
  // Pattern detection
  const patterns = {
    exploration: ['tell me', 'what', 'how', 'why', 'when', 'explore'],
    problem_solving: ['help', 'solve', 'fix', 'improve', 'better', 'change'],
    reflection: ['think', 'feel', 'realize', 'understand', 'learned'],
    crisis: ['urgent', 'emergency', 'crisis', 'desperate', 'can\'t', 'overwhelmed'],
    progress_tracking: ['progress', 'better', 'worse', 'improving', 'tracking', 'compare']
  };

  let maxScore = 0;
  let detectedPattern = 'exploration';

  for (const [pattern, keywords] of Object.entries(patterns)) {
    const score = keywords.reduce((acc, keyword) => {
      return acc + recentMessages.filter(msg => msg.includes(keyword)).length;
    }, 0);

    if (score > maxScore) {
      maxScore = score;
      detectedPattern = pattern;
    }
  }

  const confidence = Math.min(maxScore / recentMessages.length, 1.0);

  const directions = {
    exploration: 'Continue exploring their thoughts and feelings with open-ended questions',
    problem_solving: 'Focus on actionable insights and practical suggestions',
    reflection: 'Encourage deeper self-reflection and pattern recognition',
    crisis: 'Provide immediate support and gentle guidance',
    progress_tracking: 'Compare current state with past entries and highlight growth'
  };

  return {
    pattern: detectedPattern as any,
    confidence,
    suggestedDirection: directions[detectedPattern as keyof typeof directions]
  };
}