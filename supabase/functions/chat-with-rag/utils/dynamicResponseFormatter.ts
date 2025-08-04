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
  
  // Enhanced analytical query detection
  const isComplexAnalysis = /analyze|analysis|patterns|trends|comparison|insights|overall|generally|typically|usually|how am i|what has|when do|how often|frequency|breakdown|summary|overview|statistics|what time|most|least|improve|decline|changed|better|worse|since|throughout|during|recently|lately/i.test(lowerMessage);
  
  // Enhanced multi-aspect detection
  const hasMultipleAspects = /positive|negative|good|bad|better|worse|improve|decline|both|different|various|multiple|aspects|sides|perspectives|areas|issues|topics|themes|ways|before and after|then and now|comparison/i.test(lowerMessage);
  
  // Enhanced format-requiring query detection
  const requiresStructuredFormat = /breakdown|list|explain|describe.*patterns|show me|tell me about.*trends|what are|identify|categorize|organize|structure/i.test(lowerMessage);
  
  // Enhanced complexity indicators
  const complexityIndicators = [
    /why.*happening|what.*causing|relationship.*between|correlation|impact.*on|effect.*of/i.test(lowerMessage),
    /over time|timeline|progression|evolution|development|journey|growth|change/i.test(lowerMessage),
    /different.*ways|various.*methods|multiple.*factors|several.*reasons|many.*aspects/i.test(lowerMessage),
    hasMultipleAspects,
    isComplexAnalysis
  ];
  
  const isMeditation = lowerMessage.includes('meditation') || lowerMessage.includes('practice');
  const isImpactQuery = /impact|effect|influence|affect|outcome|result|relationship|consequence|leads to|results in|causes/i.test(lowerMessage);
  const hasPersonalPronouns = queryPlan?.hasPersonalPronouns || /\b(i|my|me|myself|i'm|i've|i'll|i'd)\b/i.test(lowerMessage);
  const isMultiQuestion = subQuestionResults.length > 1;
  
  // Enhanced complexity determination
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  const complexityScore = complexityIndicators.filter(Boolean).length;
  
  if (complexityScore >= 3 || isMultiQuestion || (isComplexAnalysis && hasMultipleAspects)) {
    complexity = 'complex';
  } else if (complexityScore >= 2 || hasPersonalPronouns || isImpactQuery || hasMultipleAspects || requiresStructuredFormat) {
    complexity = 'moderate';
  }
  
  // Enhanced format type determination
  let formatType: 'conversational' | 'analytical' | 'structured' | 'narrative' = 'conversational';
  
  if (isComplexAnalysis || requiresStructuredFormat || complexityScore >= 3) {
    formatType = 'analytical';
  } else if (complexity === 'complex' || isMultiQuestion || hasMultipleAspects) {
    formatType = 'structured';
  } else if (hasPersonalPronouns && !isComplexAnalysis && complexity === 'simple') {
    formatType = 'narrative';
  }
  
  // Enhanced format options configuration
  const config: ResponseFormatConfig = {
    useStructuredFormat: formatType === 'analytical' || formatType === 'structured' || complexity !== 'simple',
    includeHeaders: formatType === 'analytical' || formatType === 'structured' || requiresStructuredFormat,
    includeEmojis: formatType === 'analytical' || formatType === 'structured' || formatType === 'conversational',
    useBulletPoints: formatType === 'analytical' || formatType === 'structured' || hasMultipleAspects,
    includeInsights: complexity !== 'simple' || isComplexAnalysis || formatType === 'analytical',
    includeSummary: isMultiQuestion || complexity === 'complex' || formatType === 'analytical',
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
  
  // Add format-specific instructions with enhanced formatting requirements
  if (formatConfig.formatType === 'analytical') {
    basePrompt += `\n\nCRITICAL FORMATTING REQUIREMENTS - ANALYTICAL:
## FORMAT STRUCTURE (MANDATORY):
- **ALWAYS** use ## markdown headers for main sections
- **ALWAYS** use - for bullet points (not •)
- **ALWAYS** use **bold text** for key insights and data points
- **ALWAYS** include emojis in headers for visual appeal

## REQUIRED SECTIONS:
### 🔍 **Key Insights**
- **Primary finding**: [main insight with specific data]
- **Supporting evidence**: [specific examples from journal entries]

### 📊 **Patterns Identified**  
- [Pattern 1 with specific dates/examples]
- [Pattern 2 with quantifiable evidence]

### 💡 **Recommendations**
- [Actionable suggestion based on analysis]

EXAMPLE RESPONSE FORMAT:
## 🌟 **Positive Patterns**
- **Meditation consistency**: You've been meditating 5 days a week since April
- **Mood improvement**: 40% increase in positive emotional words

## ⚠️ **Areas for Growth**
- **Sleep patterns**: Inconsistent bedtime affecting energy levels
- **Work stress**: Peak stress during Mondays and Wednesdays`;
    
  } else if (formatConfig.formatType === 'structured') {
    basePrompt += `\n\nCRITICAL FORMATTING REQUIREMENTS - STRUCTURED:
## FORMAT STRUCTURE (MANDATORY):
- **ALWAYS** use ## markdown headers for main sections
- **ALWAYS** use - for bullet points with **bold** key terms
- **ALWAYS** include emojis in section headers
- **ALWAYS** provide specific examples with dates

## REQUIRED STRUCTURE:
### 📝 **Overview**
- Brief summary of findings

### 🔍 **Detailed Analysis**
- **Key observation 1**: [specific example]
- **Key observation 2**: [specific example]

### 💭 **Personal Insights**
- [Insight related to personal growth]`;
    
  } else if (formatConfig.formatType === 'narrative') {
    basePrompt += `\n\nCRITICAL FORMATTING REQUIREMENTS - NARRATIVE:
## FORMAT STRUCTURE (MANDATORY):
- Write in flowing paragraphs with **bold emphasis** on key insights
- Use ## headers sparingly for major topic shifts
- Include specific dates and examples naturally in the text
- Use emojis to highlight emotional moments

EXAMPLE: "Looking at your meditation journey since late April 💫, I can see a **remarkable transformation** in your approach to stress. On April 28th, you wrote about feeling overwhelmed, but by May 15th, your entries show **significantly more calm and centeredness**."`;
    
  } else {
    basePrompt += `\n\nCRITICAL FORMATTING REQUIREMENTS - CONVERSATIONAL:
## FORMAT STRUCTURE (MANDATORY):
- Use natural language with **bold emphasis** on important points
- Include specific examples and dates in conversational tone
- Use emojis to convey warmth and support
- Keep bullet points minimal but use - when listing items

EXAMPLE: "I noticed something interesting in your entries 😊 - your **meditation practice** really seems to be making a difference! On May 10th you mentioned feeling more centered, and that pattern continues through your recent entries."`;
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