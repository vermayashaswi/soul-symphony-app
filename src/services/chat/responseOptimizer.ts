/**
 * Phase 2: Context-aware response sizing and conversational flow awareness
 * Phase 4: Response length intelligence and emotional intelligence
 */

export interface ResponseOptimizationConfig {
  maxLength: number;
  minLength: number;
  preferredStyle: 'concise' | 'detailed' | 'analytical' | 'conversational' | 'therapeutic';
  emotionalTone: 'supportive' | 'analytical' | 'encouraging' | 'neutral' | 'empathetic' | 'validating';
  includeExamples: boolean;
  includeActionables: boolean;
  formatForMobile: boolean;
  shouldAskFollowUp: boolean;
  useFlexibleFormat: boolean;
  therapistPersonality: 'warm' | 'analytical' | 'gentle' | 'encouraging';
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
  
  // Enhanced therapist-like response configuration
  let config: ResponseOptimizationConfig = {
    maxLength: 400,
    minLength: 100,
    preferredStyle: 'therapeutic',
    emotionalTone: 'empathetic',
    includeExamples: false,
    includeActionables: false,
    formatForMobile: true,
    shouldAskFollowUp: true,
    useFlexibleFormat: true,
    therapistPersonality: 'warm'
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

// Enhanced query classification for therapist-like responses
export function classifyQueryIntent(
  userMessage: string,
  conversationContext: any[]
): {
  queryType: 'simple_question' | 'emotional_exploration' | 'pattern_analysis' | 'crisis_support' | 'reflection_prompt';
  complexity: 'simple' | 'moderate' | 'complex';
  needsFollowUp: boolean;
  suggestedFollowUpType: 'clarification' | 'exploration' | 'validation' | 'none';
  therapistApproach: 'reflective' | 'supportive' | 'analytical' | 'validating';
} {
  const lowerMessage = userMessage.toLowerCase();
  
  // Simple question indicators
  const simpleQuestionPatterns = [
    /^(what|how|when|where|why)\s/i,
    /\b(tell me|show me|explain)\b/i,
    /\?\s*$/
  ];
  
  // Emotional exploration indicators
  const emotionalPatterns = [
    /\b(feel|feeling|emotion|mood|sad|happy|anxious|angry|worried|excited)\b/i,
    /\b(struggling|difficult|hard|challenging)\b/i
  ];
  
  // Pattern analysis indicators
  const patternPatterns = [
    /\b(pattern|trend|usually|always|never|often|sometimes)\b/i,
    /\b(when do|what time|how often|frequency)\b/i
  ];
  
  // Crisis support indicators
  const crisisPatterns = [
    /\b(crisis|emergency|urgent|desperate|can't|overwhelmed|suicide|harm)\b/i,
    /\b(help me|need help|don't know what to do)\b/i
  ];
  
  // Determine query type
  let queryType: 'simple_question' | 'emotional_exploration' | 'pattern_analysis' | 'crisis_support' | 'reflection_prompt' = 'simple_question';
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  let therapistApproach: 'reflective' | 'supportive' | 'analytical' | 'validating' = 'supportive';
  
  if (crisisPatterns.some(pattern => pattern.test(lowerMessage))) {
    queryType = 'crisis_support';
    complexity = 'complex';
    therapistApproach = 'supportive';
  } else if (patternPatterns.some(pattern => pattern.test(lowerMessage))) {
    queryType = 'pattern_analysis';
    complexity = 'complex';
    therapistApproach = 'analytical';
  } else if (emotionalPatterns.some(pattern => pattern.test(lowerMessage))) {
    queryType = 'emotional_exploration';
    complexity = 'moderate';
    therapistApproach = 'reflective';
  } else if (simpleQuestionPatterns.some(pattern => pattern.test(lowerMessage))) {
    queryType = 'simple_question';
    complexity = 'simple';
    therapistApproach = 'validating';
  } else {
    queryType = 'reflection_prompt';
    complexity = 'moderate';
    therapistApproach = 'reflective';
  }
  
  // Determine follow-up needs
  const needsFollowUp = queryType !== 'crisis_support' && (
    userMessage.length < 50 || 
    queryType === 'simple_question' ||
    !userMessage.includes('?')
  );
  
  let suggestedFollowUpType: 'clarification' | 'exploration' | 'validation' | 'none' = 'none';
  
  if (needsFollowUp) {
    switch (queryType) {
      case 'simple_question':
        suggestedFollowUpType = 'clarification';
        break;
      case 'emotional_exploration':
        suggestedFollowUpType = 'exploration';
        break;
      case 'reflection_prompt':
        suggestedFollowUpType = 'validation';
        break;
      default:
        suggestedFollowUpType = 'exploration';
    }
  }
  
  return {
    queryType,
    complexity,
    needsFollowUp,
    suggestedFollowUpType,
    therapistApproach
  };
}

// Generate intelligent follow-up questions
export function generateFollowUpQuestions(
  queryClassification: ReturnType<typeof classifyQueryIntent>,
  userMessage: string,
  emotionalContext?: ReturnType<typeof analyzeEmotionalContext>
): string[] {
  const followUpQuestions: string[] = [];
  
  switch (queryClassification.suggestedFollowUpType) {
    case 'clarification':
      followUpQuestions.push(
        "What specific aspect of this would be most helpful to explore?",
        "Is there a particular time period you'd like me to focus on?",
        "Would you like me to look at any specific emotions or themes?"
      );
      break;
      
    case 'exploration':
      if (emotionalContext?.needsSupport) {
        followUpQuestions.push(
          "How has this been affecting your daily life?",
          "What support systems do you have in place?",
          "When do you notice these feelings are strongest?"
        );
      } else {
        followUpQuestions.push(
          "What do you think might be behind these feelings?",
          "Have you noticed any patterns in when this comes up?",
          "What would it look like if this felt different?"
        );
      }
      break;
      
    case 'validation':
      followUpQuestions.push(
        "What resonates most with you about this insight?",
        "How does this awareness feel for you right now?",
        "What would you like to explore further about this?"
      );
      break;
  }
  
  // Add context-specific questions based on emotional state
  if (emotionalContext?.sensitiveTopics.length) {
    const topic = emotionalContext.sensitiveTopics[0];
    switch (topic) {
      case 'relationships':
        followUpQuestions.push("How are your relationships feeling right now?");
        break;
      case 'work':
        followUpQuestions.push("How is work impacting your wellbeing?");
        break;
      case 'self-worth':
        followUpQuestions.push("What's your relationship with yourself like lately?");
        break;
    }
  }
  
  return followUpQuestions.slice(0, 2); // Return top 2 most relevant
}