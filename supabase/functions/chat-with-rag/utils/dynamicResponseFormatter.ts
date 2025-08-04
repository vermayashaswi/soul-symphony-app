// Dynamic response formatting based on query complexity and context

export interface ResponseFormatConfig {
  useStructuredFormat: boolean;
  includeHeaders: boolean;
  includeEmojis: boolean;
  useBulletPoints: boolean;
  includeInsights: boolean;
  includeSummary: boolean;
  formatType: 'conversational' | 'analytical' | 'structured' | 'narrative';
  complexity: 'simple' | 'moderate' | 'complex';
}

export function determineResponseFormat(
  userMessage: string, 
  queryPlan: any, 
  conversationContext: any[] = [],
  subQuestionResults: any[] = []
): ResponseFormatConfig {
  const lowerMessage = userMessage.toLowerCase();
  
  // Analyze query characteristics
  const isComplexAnalysis = /analyze|analysis|patterns|trends|comparison|insights|overall|generally|typically|usually|how am i/i.test(lowerMessage);
  const hasMultipleAspects = /positive|negative|good|bad|better|worse|improve|decline|both|different|various|multiple/i.test(lowerMessage);
  const isMeditation = lowerMessage.includes('meditation') || lowerMessage.includes('practice');
  const isImpactQuery = /impact|effect|influence|affect|outcome|result|relationship/i.test(lowerMessage);
  const hasPersonalPronouns = queryPlan?.hasPersonalPronouns || false;
  const isMultiQuestion = subQuestionResults.length > 1;
  
  // Determine complexity
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (isComplexAnalysis || isMultiQuestion || (hasMultipleAspects && isMeditation)) {
    complexity = 'complex';
  } else if (hasPersonalPronouns || isImpactQuery || hasMultipleAspects) {
    complexity = 'moderate';
  }
  
  // Determine format type
  let formatType: 'conversational' | 'analytical' | 'structured' | 'narrative' = 'conversational';
  if (isComplexAnalysis && isMultiQuestion) {
    formatType = 'analytical';
  } else if (complexity === 'complex') {
    formatType = 'structured';
  } else if (hasPersonalPronouns && !isComplexAnalysis) {
    formatType = 'narrative';
  }
  
  // Configure format options
  const config: ResponseFormatConfig = {
    useStructuredFormat: complexity !== 'simple' && formatType !== 'conversational',
    includeHeaders: formatType === 'analytical' || (formatType === 'structured' && isMultiQuestion),
    includeEmojis: complexity !== 'simple' || formatType === 'conversational',
    useBulletPoints: formatType === 'analytical' || (formatType === 'structured' && isMultiQuestion),
    includeInsights: complexity === 'complex' || isComplexAnalysis,
    includeSummary: isMultiQuestion || complexity === 'complex',
    formatType,
    complexity
  };
  
  console.log(`[Response Format] Determined format:`, {
    message: userMessage.substring(0, 50) + '...',
    complexity,
    formatType,
    isMultiQuestion,
    config
  });
  
  return config;
}

export function generateSystemPromptWithFormat(
  formatConfig: ResponseFormatConfig,
  userMessage: string,
  contextData: string,
  queryPlan: any
): string {
  let basePrompt = `You are SOULo, an empathetic AI companion helping someone understand their journal entries.`;
  
  // Add format-specific instructions
  if (formatConfig.formatType === 'analytical') {
    basePrompt += `\n\nRESPONSE FORMAT - ANALYTICAL:
- Use clear headers with emojis (e.g., "🌟 Positive Patterns", "⚠️ Areas of Concern")
- Present findings in bulleted lists with specific examples
- Include an "✨ Key Insights" section
- End with a brief summary and actionable suggestions
- Be thorough but organized - this is complex analysis`;
    
  } else if (formatConfig.formatType === 'structured') {
    basePrompt += `\n\nRESPONSE FORMAT - STRUCTURED:
- Organize your response with clear sections
- Use emojis for section headers when appropriate
- Include specific examples from the journal entries
- Provide both observations and insights
- Keep it well-organized but warm and personal`;
    
  } else if (formatConfig.formatType === 'narrative') {
    basePrompt += `\n\nRESPONSE FORMAT - NARRATIVE:
- Write in a flowing, conversational style
- Weave insights naturally into the narrative
- Be warm and supportive in tone
- Include specific examples but integrate them smoothly
- Focus on personal growth and understanding`;
    
  } else {
    basePrompt += `\n\nRESPONSE FORMAT - CONVERSATIONAL:
- Respond naturally and warmly
- Use specific examples from the journal entries
- Be supportive and insightful
- Keep it personal and engaging`;
  }
  
  // Add context awareness
  if (queryPlan?.subQuestions?.length > 1) {
    basePrompt += `\n\nMULTI-ASPECT ANALYSIS:
You have data from ${queryPlan.subQuestions.length} different search perspectives. Combine these insights to give a comprehensive view.`;
  }
  
  // Add meditation-specific guidance if applicable
  if (userMessage.toLowerCase().includes('meditation')) {
    basePrompt += `\n\nMEDITATION ANALYSIS GUIDANCE:
- Look for patterns in emotional states before/after meditation
- Note frequency and consistency of practice
- Identify specific benefits and challenges
- Consider the broader impact on daily life and well-being`;
  }
  
  basePrompt += `\n\nUSER'S QUERY: "${userMessage}"
  
Available context: ${contextData}

Provide a ${formatConfig.complexity} analysis that helps the user understand their patterns and growth.`;

  return basePrompt;
}

export function combineSubQuestionResults(subQuestionResults: any[]): string {
  if (subQuestionResults.length <= 1) {
    return subQuestionResults[0]?.context || '';
  }
  
  // Combine results from multiple sub-questions
  let combinedContext = '';
  
  subQuestionResults.forEach((result, index) => {
    if (result?.context) {
      combinedContext += `\n\n=== Sub-Analysis ${index + 1}: ${result.subQuestion?.question || 'Analysis'} ===\n`;
      combinedContext += result.context;
      
      if (result.emotionResults?.length > 0) {
        combinedContext += `\n\nEmotion Analysis: Found ${result.emotionResults.length} relevant emotional patterns.`;
      }
      
      if (result.vectorResults?.length > 0) {
        combinedContext += `\n\nSemantic Analysis: Found ${result.vectorResults.length} contextually relevant entries.`;
      }
    }
  });
  
  return combinedContext;
}