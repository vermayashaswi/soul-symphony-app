// Enhanced sub-question generator for complex analytical queries

export interface SubQuestion {
  question: string;
  type: 'temporal' | 'emotional' | 'causal' | 'comparative' | 'pattern' | 'specific';
  priority: number;
  searchStrategy: 'vector' | 'sql' | 'hybrid';
}

export function generateSubQuestions(
  userMessage: string,
  queryPlan: any,
  conversationContext: any[] = []
): SubQuestion[] {
  const lowerMessage = userMessage.toLowerCase();
  const subQuestions: SubQuestion[] = [];
  
  console.log(`[SubQuestionGenerator] Analyzing: "${userMessage}"`);
  
  // Enhanced pattern detection for analytical queries
  const analyticalPatterns = {
    improvement: /improve|improved|better|progress|growth|positive|decline|worse|negative/i,
    temporal: /since|when|over time|recently|lately|before|after|during|throughout|timeline|progression/i,
    patterns: /pattern|trend|usually|typically|often|frequency|consistently|regularly/i,
    comparison: /different|compare|versus|vs|contrast|both|either|neither|between/i,
    causation: /why|because|reason|cause|effect|impact|influence|result|outcome|leads to/i,
    emotional: /feel|emotion|mood|stress|anxiety|happy|sad|excited|calm|overwhelmed/i,
    specific: /what|which|how|where|specific|details|examples|instances/i
  };

  // Detect query complexity and generate appropriate sub-questions
  const complexityIndicators = Object.entries(analyticalPatterns).filter(([_, pattern]) => 
    pattern.test(lowerMessage)
  );
  
  console.log(`[SubQuestionGenerator] Detected patterns:`, complexityIndicators.map(([key]) => key));

  if (complexityIndicators.length === 0) {
    // Simple query - create a single focused sub-question
    return [{
      question: userMessage,
      type: 'specific',
      priority: 1,
      searchStrategy: 'hybrid'
    }];
  }

  // For complex analytical queries, generate multiple sub-questions
  if (analyticalPatterns.improvement.test(lowerMessage)) {
    if (lowerMessage.includes('not') || lowerMessage.includes("hasn't")) {
      // "What has not improved?" type queries
      subQuestions.push({
        question: extractCoreImprovementQuery(userMessage, 'negative'),
        type: 'comparative',
        priority: 1,
        searchStrategy: 'hybrid'
      });
      
      subQuestions.push({
        question: "What are the persistent challenges or ongoing issues mentioned in recent entries?",
        type: 'pattern',
        priority: 2,
        searchStrategy: 'sql'
      });
      
      subQuestions.push({
        question: "What areas show stagnation or lack of progress over time?",
        type: 'temporal',
        priority: 3,
        searchStrategy: 'vector'
      });
    } else {
      // "Have I improved?" type queries
      subQuestions.push({
        question: extractCoreImprovementQuery(userMessage, 'positive'),
        type: 'comparative',
        priority: 1,
        searchStrategy: 'hybrid'
      });
      
      subQuestions.push({
        question: "What positive changes and progress are mentioned in recent entries?",
        type: 'pattern',
        priority: 2,
        searchStrategy: 'vector'
      });
      
      if (analyticalPatterns.temporal.test(lowerMessage)) {
        subQuestions.push({
          question: "How have patterns changed over the specified time period?",
          type: 'temporal',
          priority: 3,
          searchStrategy: 'sql'
        });
      }
    }
  }

  if (analyticalPatterns.emotional.test(lowerMessage)) {
    subQuestions.push({
      question: "What emotional patterns and mood changes are evident in the entries?",
      type: 'emotional',
      priority: 1,
      searchStrategy: 'sql'
    });
  }

  if (analyticalPatterns.patterns.test(lowerMessage)) {
    subQuestions.push({
      question: "What behavioral patterns and recurring themes appear frequently?",
      type: 'pattern',
      priority: 2,
      searchStrategy: 'vector'
    });
  }

  if (analyticalPatterns.causation.test(lowerMessage)) {
    subQuestions.push({
      question: "What cause-and-effect relationships or triggers are mentioned?",
      type: 'causal',
      priority: 2,
      searchStrategy: 'hybrid'
    });
  }

  // Ensure we have at least one sub-question, maximum 4 for performance
  if (subQuestions.length === 0) {
    subQuestions.push({
      question: userMessage,
      type: 'specific',
      priority: 1,
      searchStrategy: 'hybrid'
    });
  }

  // Sort by priority and limit to top 4
  const sortedQuestions = subQuestions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);

  console.log(`[SubQuestionGenerator] Generated ${sortedQuestions.length} sub-questions:`, 
    sortedQuestions.map(q => ({ question: q.question.substring(0, 60) + '...', type: q.type }))
  );

  return sortedQuestions;
}

function extractCoreImprovementQuery(userMessage: string, type: 'positive' | 'negative'): string {
  const lowerMessage = userMessage.toLowerCase();
  
  // Extract specific areas mentioned in the query
  const areaPatterns = {
    meditation: /meditation|mindfulness|practice/i,
    sleep: /sleep|rest|bedtime|wake/i,
    work: /work|job|career|productivity/i,
    relationships: /relationship|friend|family|social/i,
    health: /health|exercise|fitness|physical/i,
    mood: /mood|emotion|feel|mental|anxiety|stress/i
  };

  const mentionedAreas = Object.entries(areaPatterns)
    .filter(([_, pattern]) => pattern.test(userMessage))
    .map(([area]) => area);

  if (mentionedAreas.length > 0) {
    const areaContext = mentionedAreas.join(', ');
    return type === 'positive' 
      ? `What improvements and positive changes are evident in ${areaContext} based on journal entries?`
      : `What ongoing challenges or areas of concern persist in ${areaContext} based on journal entries?`;
  }

  // Generic improvement queries
  return type === 'positive'
    ? "What areas show clear improvement, progress, or positive changes in recent journal entries?"
    : "What areas show ongoing challenges, stagnation, or negative patterns in recent journal entries?";
}

export function shouldGenerateMultipleSubQuestions(userMessage: string, queryPlan: any): boolean {
  const lowerMessage = userMessage.toLowerCase();
  
  // Check for complexity indicators that warrant multiple sub-questions
  const complexitySignals = [
    /analyze|analysis|breakdown|overall|comprehensive/i.test(lowerMessage),
    /improve.*and|both.*and|different.*aspects|various.*areas/i.test(lowerMessage),
    /patterns.*and|trends.*and|before.*and.*after/i.test(lowerMessage),
    /why.*how|what.*when|where.*how/i.test(lowerMessage),
    queryPlan?.complexity === 'complex',
    queryPlan?.hasMultipleAspects
  ];

  const shouldGenerate = complexitySignals.filter(Boolean).length >= 2;
  
  console.log(`[SubQuestionGenerator] Should generate multiple sub-questions: ${shouldGenerate}`, {
    complexitySignals: complexitySignals.filter(Boolean).length,
    queryComplexity: queryPlan?.complexity
  });

  return shouldGenerate;
}