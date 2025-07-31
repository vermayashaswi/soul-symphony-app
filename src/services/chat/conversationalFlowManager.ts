/**
 * Phase 2: Context-aware response sizing and conversational flow awareness
 * Phase 4: Conversational patterns and emotional intelligence
 */

export interface ConversationState {
  threadId: string;
  messageCount: number;
  topicProgression: string[];
  userEngagementLevel: 'high' | 'medium' | 'low';
  emotionalTrajectory: Array<{
    emotion: string;
    intensity: number;
    timestamp: string;
  }>;
  conversationMode: 'exploration' | 'problem_solving' | 'reflection' | 'crisis' | 'progress_tracking';
  lastUserIntent: string;
  needsTransition: boolean;
}

export interface FlowRecommendation {
  suggestedResponseLength: 'brief' | 'moderate' | 'detailed';
  suggestedTone: 'gentle' | 'encouraging' | 'analytical' | 'celebratory' | 'supportive';
  shouldAskFollowUp: boolean;
  suggestedFollowUp?: string;
  topicTransition?: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'crisis';
}

export class ConversationalFlowManager {
  private conversationStates: Map<string, ConversationState> = new Map();

  // Phase 2: Analyze conversation flow and provide recommendations
  analyzeConversationalFlow(
    threadId: string,
    currentMessage: string,
    messageHistory: any[],
    userEmotionalState?: { primaryEmotion: string; intensity: number }
  ): FlowRecommendation {
    
    let state = this.conversationStates.get(threadId);
    if (!state) {
      state = this.initializeConversationState(threadId);
    }

    // Update conversation state
    state = this.updateConversationState(state, currentMessage, messageHistory, userEmotionalState);
    this.conversationStates.set(threadId, state);

    // Generate flow recommendations
    return this.generateFlowRecommendations(state, currentMessage);
  }

  private initializeConversationState(threadId: string): ConversationState {
    return {
      threadId,
      messageCount: 0,
      topicProgression: [],
      userEngagementLevel: 'medium',
      emotionalTrajectory: [],
      conversationMode: 'exploration',
      lastUserIntent: '',
      needsTransition: false
    };
  }

  private updateConversationState(
    state: ConversationState,
    currentMessage: string,
    messageHistory: any[],
    userEmotionalState?: { primaryEmotion: string; intensity: number }
  ): ConversationState {
    
    const updatedState = { ...state };
    updatedState.messageCount = messageHistory.length;

    // Phase 4: Update emotional trajectory
    if (userEmotionalState) {
      updatedState.emotionalTrajectory.push({
        emotion: userEmotionalState.primaryEmotion,
        intensity: userEmotionalState.intensity,
        timestamp: new Date().toISOString()
      });

      // Keep only recent 10 emotional states
      if (updatedState.emotionalTrajectory.length > 10) {
        updatedState.emotionalTrajectory.shift();
      }
    }

    // Analyze user engagement level
    updatedState.userEngagementLevel = this.assessEngagementLevel(currentMessage, messageHistory);

    // Detect conversation mode
    updatedState.conversationMode = this.detectConversationMode(currentMessage, messageHistory);

    // Track topic progression
    const currentTopic = this.extractTopic(currentMessage);
    if (currentTopic && !updatedState.topicProgression.includes(currentTopic)) {
      updatedState.topicProgression.push(currentTopic);
      updatedState.needsTransition = updatedState.topicProgression.length > 3;
    }

    // Detect user intent
    updatedState.lastUserIntent = this.detectUserIntent(currentMessage);

    return updatedState;
  }

  // Phase 2: Assess user engagement for response optimization
  private assessEngagementLevel(currentMessage: string, messageHistory: any[]): 'high' | 'medium' | 'low' {
    const messageLength = currentMessage.trim().split(/\s+/).length;
    const recentMessages = messageHistory.slice(-3);
    
    // High engagement indicators
    const highEngagementPatterns = [
      /tell me more/i,
      /that's interesting/i,
      /can you explain/i,
      /what about/i,
      /how does/i,
      /why do/i
    ];

    // Low engagement indicators
    const lowEngagementPatterns = [
      /^yes$/i,
      /^no$/i,
      /^ok$/i,
      /^fine$/i,
      /^sure$/i,
      /^i guess$/i
    ];

    if (highEngagementPatterns.some(pattern => pattern.test(currentMessage)) || messageLength > 15) {
      return 'high';
    }

    if (lowEngagementPatterns.some(pattern => pattern.test(currentMessage)) || messageLength < 3) {
      return 'low';
    }

    // Check for declining engagement
    const avgRecentLength = recentMessages.reduce((sum, msg) => 
      sum + (msg.content?.split(/\s+/).length || 0), 0) / Math.max(recentMessages.length, 1);
    
    if (avgRecentLength < 5) {
      return 'low';
    }

    return 'medium';
  }

  // Phase 4: Detect conversation mode for appropriate response strategy
  private detectConversationMode(currentMessage: string, messageHistory: any[]): ConversationState['conversationMode'] {
    const lowerMessage = currentMessage.toLowerCase();
    const recentMessages = messageHistory.slice(-5).map(msg => msg.content?.toLowerCase() || '');

    // Crisis detection
    const crisisIndicators = [
      'emergency', 'crisis', 'urgent', 'desperate', 'can\'t handle', 
      'overwhelming', 'breaking down', 'need help now'
    ];
    if (crisisIndicators.some(indicator => lowerMessage.includes(indicator))) {
      return 'crisis';
    }

    // Problem-solving mode
    const problemSolvingIndicators = [
      'how can i', 'what should i', 'help me', 'fix', 'solve', 
      'improve', 'change', 'better', 'advice'
    ];
    if (problemSolvingIndicators.some(indicator => lowerMessage.includes(indicator))) {
      return 'problem_solving';
    }

    // Progress tracking mode
    const progressIndicators = [
      'progress', 'improvement', 'better than', 'worse than', 
      'compared to', 'tracking', 'growth', 'change over time'
    ];
    if (progressIndicators.some(indicator => lowerMessage.includes(indicator))) {
      return 'progress_tracking';
    }

    // Reflection mode
    const reflectionIndicators = [
      'i think', 'i feel', 'i realize', 'i understand', 
      'looking back', 'reflecting', 'insight', 'learned'
    ];
    if (reflectionIndicators.some(indicator => lowerMessage.includes(indicator))) {
      return 'reflection';
    }

    // Default to exploration
    return 'exploration';
  }

  private extractTopic(message: string): string | null {
    const topicPatterns = {
      'relationships': /relationship|partner|friend|family|love|dating/i,
      'work': /work|job|career|office|colleague|boss/i,
      'health': /health|exercise|sleep|eat|medical|wellness/i,
      'emotions': /feel|emotion|mood|happy|sad|angry|anxious/i,
      'goals': /goal|dream|ambition|future|plan|achieve/i,
      'habits': /habit|routine|daily|practice|pattern/i,
      'stress': /stress|pressure|overwhelm|tension|worry/i
    };

    for (const [topic, pattern] of Object.entries(topicPatterns)) {
      if (pattern.test(message)) {
        return topic;
      }
    }
    return null;
  }

  private detectUserIntent(message: string): string {
    const intentPatterns = {
      'seeking_insight': /understand|insight|pattern|why|how|what makes/i,
      'seeking_support': /support|help|comfort|difficult|struggling/i,
      'seeking_validation': /am i|do i|is it normal|does this make sense/i,
      'exploring_emotions': /feel|emotion|mood|emotional|feeling/i,
      'tracking_progress': /progress|improvement|better|growth|change/i,
      'problem_solving': /solve|fix|improve|change|better|what should/i,
      'reflection': /think|realize|understand|learned|looking back/i
    };

    for (const [intent, pattern] of Object.entries(intentPatterns)) {
      if (pattern.test(message)) {
        return intent;
      }
    }
    return 'general_inquiry';
  }

  // Phase 2 & 4: Generate comprehensive flow recommendations
  private generateFlowRecommendations(state: ConversationState, currentMessage: string): FlowRecommendation {
    const recommendation: FlowRecommendation = {
      suggestedResponseLength: 'moderate',
      suggestedTone: 'supportive',
      shouldAskFollowUp: false,
      urgencyLevel: 'low'
    };

    // Adjust based on conversation mode
    switch (state.conversationMode) {
      case 'crisis':
        recommendation.suggestedResponseLength = 'brief';
        recommendation.suggestedTone = 'gentle';
        recommendation.urgencyLevel = 'crisis';
        recommendation.shouldAskFollowUp = true;
        recommendation.suggestedFollowUp = "How are you feeling right now? Is there someone you can talk to or reach out to for immediate support?";
        break;

      case 'problem_solving':
        recommendation.suggestedResponseLength = 'detailed';
        recommendation.suggestedTone = 'analytical';
        recommendation.shouldAskFollowUp = true;
        recommendation.suggestedFollowUp = "What specific step feels most manageable to try first?";
        break;

      case 'reflection':
        recommendation.suggestedResponseLength = 'moderate';
        recommendation.suggestedTone = 'encouraging';
        recommendation.shouldAskFollowUp = true;
        recommendation.suggestedFollowUp = "What other insights have you discovered about yourself recently?";
        break;

      case 'progress_tracking':
        recommendation.suggestedResponseLength = 'detailed';
        recommendation.suggestedTone = 'celebratory';
        recommendation.shouldAskFollowUp = true;
        recommendation.suggestedFollowUp = "What would you like to focus on improving next?";
        break;

      case 'exploration':
        recommendation.suggestedResponseLength = 'moderate';
        recommendation.suggestedTone = 'supportive';
        recommendation.shouldAskFollowUp = true;
        recommendation.suggestedFollowUp = "What aspects of this would you like to explore further?";
        break;
    }

    // Adjust based on engagement level
    if (state.userEngagementLevel === 'low') {
      recommendation.suggestedResponseLength = 'brief';
      recommendation.suggestedTone = 'encouraging';
      recommendation.shouldAskFollowUp = true;
      recommendation.suggestedFollowUp = "Is there something specific on your mind today?";
    } else if (state.userEngagementLevel === 'high') {
      recommendation.suggestedResponseLength = 'detailed';
    }

    // Emotional trajectory considerations
    if (state.emotionalTrajectory.length > 0) {
      const recentEmotions = state.emotionalTrajectory.slice(-3);
      const negativeEmotions = recentEmotions.filter(e => 
        ['sad', 'anxious', 'angry', 'frustrated', 'overwhelmed'].includes(e.emotion)
      );

      if (negativeEmotions.length >= 2) {
        recommendation.suggestedTone = 'gentle';
        recommendation.urgencyLevel = 'medium';
      }

      const positiveEmotions = recentEmotions.filter(e => 
        ['happy', 'excited', 'proud', 'grateful', 'confident'].includes(e.emotion)
      );

      if (positiveEmotions.length >= 2) {
        recommendation.suggestedTone = 'celebratory';
      }
    }

    // Topic transition handling
    if (state.needsTransition) {
      recommendation.topicTransition = "I notice we've covered several different areas. Would you like to dive deeper into any particular topic, or is there something else on your mind?";
    }

    return recommendation;
  }

  // Public method to get conversation insights
  getConversationInsights(threadId: string): {
    conversationLength: number;
    dominantEmotions: string[];
    engagementTrend: string;
    suggestedInterventions: string[];
  } | null {
    const state = this.conversationStates.get(threadId);
    if (!state) return null;

    // Analyze dominant emotions
    const emotionCounts = state.emotionalTrajectory.reduce((acc, entry) => {
      acc[entry.emotion] = (acc[entry.emotion] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dominantEmotions = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([emotion]) => emotion);

    // Engagement trend analysis
    let engagementTrend = 'stable';
    if (state.messageCount > 5) {
      // Simple trend analysis based on current engagement vs mode
      if (state.userEngagementLevel === 'low' && state.messageCount > 10) {
        engagementTrend = 'declining';
      } else if (state.userEngagementLevel === 'high') {
        engagementTrend = 'increasing';
      }
    }

    // Suggested interventions
    const suggestedInterventions = [];
    if (engagementTrend === 'declining') {
      suggestedInterventions.push('Ask open-ended questions to re-engage');
      suggestedInterventions.push('Acknowledge their sharing and validate their experience');
    }

    if (dominantEmotions.includes('anxious') || dominantEmotions.includes('stressed')) {
      suggestedInterventions.push('Offer grounding techniques or breathing exercises');
    }

    if (state.conversationMode === 'problem_solving' && state.messageCount > 15) {
      suggestedInterventions.push('Summarize actionable insights and next steps');
    }

    return {
      conversationLength: state.messageCount,
      dominantEmotions,
      engagementTrend,
      suggestedInterventions
    };
  }
}
