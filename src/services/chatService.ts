import { QueryTypes } from '@/utils/chat/queryAnalyzer';
import { useChatMessageClassification, QueryCategory } from '@/hooks/use-chat-message-classification';
import { supabase } from '@/integrations/supabase/client';
import { analyzeQueryComplexity } from '@/services/chat/queryComplexityAnalyzer';
import { SmartQueryRouter, QueryRoute } from '@/services/chat/smartQueryRouter';
import { ConversationalFlowManager } from '@/services/chat/conversationalFlowManager';
import { optimizeResponseLength, analyzeEmotionalContext, detectConversationalPattern } from '@/services/chat/responseOptimizer';
import { ConversationStatePersistence } from '@/services/chat/conversationStatePersistence';

interface ChatResponse {
  content: string;
  role: 'assistant' | 'error';
  references?: any[];
  analysis?: any;
  hasNumericResult?: boolean;
  isInteractive?: boolean;
  interactiveOptions?: any[];
}

// Initialize optimization managers (singleton pattern for performance)
const queryRouter = new SmartQueryRouter();
const flowManager = new ConversationalFlowManager();

export async function processChatMessage(
  message: string,
  userId: string,
  queryTypes: QueryTypes,
  threadId: string,
  usePersonalContext: boolean = false,
  parameters: Record<string, any> = {}
): Promise<ChatResponse> {
  const startTime = Date.now();
  
  try {
    console.log('[ChatService] Processing message with RAG optimizations:', message);
    
    // PHASE 2: Initialize conversation state persistence
    const conversationPersistence = new ConversationStatePersistence(threadId, userId);
    await conversationPersistence.loadConversationState();
    
    console.log('[ChatService] Conversation state loaded and validated');
    
    // PHASE 1: Query complexity analysis and routing
    const complexityAnalysis = analyzeQueryComplexity(message);
    console.log('[ChatService] Complexity analysis:', {
      level: complexityAnalysis.complexityLevel,
      score: complexityAnalysis.complexityScore,
      strategy: complexityAnalysis.recommendedStrategy
    });
    
    // PHASE 1: Enhanced context retrieval with better conversation loading
    console.log('[ChatService] Loading enhanced conversation context');
    const { data: previousMessages } = await supabase
      .from('chat_messages')
      .select('content, sender, role, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(10); // Increased limit for better context

    // Build trimmed & capped conversational context
    const MAX_CONTEXT_CHARS = 1600;
    const MAX_MSG_CHARS = 500;
    const baseContext = previousMessages ?
      [...previousMessages]
        .reverse()
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: (msg.content || '').replace(/\s+/g, ' ').slice(0, MAX_MSG_CHARS).trim(),
          timestamp: msg.created_at
        })) : [];

    // Keep up to last 10 messages but cap total characters
    let conversationContext = baseContext.slice(-10);
    const totalChars = () => conversationContext.reduce((s, m) => s + (m.content?.length || 0), 0);
    while (conversationContext.length > 0 && totalChars() > MAX_CONTEXT_CHARS) {
      conversationContext.shift(); // drop oldest until within cap
    }

    const contextPreview = conversationContext.slice(-2).map(m => `${m.role}: ${m.content?.slice(0, 60)}`).join(' | ');

    console.log('[ChatService] Conversation context loaded:', {
      messagesCount: conversationContext.length,
      preview: contextPreview,
      isResumedSession: conversationContext.length > 0
    });

    // PHASE 3: Enhanced context-aware query classification with follow-up detection
    const lastAssistantMessage = conversationContext
      .slice()
      .reverse()
      .find(msg => msg.role === 'assistant');
    
    const isFollowUpMessage = conversationContext.length > 0 && 
      !!lastAssistantMessage && 
      (/(?:\bthat\b|\bthose\b|\bit\b|\bthis\b|\bthem\b)/i.test(message) ||
       /^(also|and|btw|anyway)/i.test(message.trim()) ||
       /\b(sport|football|activity|exercise|physical)\b/i.test(lastAssistantMessage.content));

    console.log('[ChatService] Follow-up detection:', {
      isFollowUp: isFollowUpMessage,
      lastAssistant: lastAssistantMessage?.content?.slice(0, 100),
      contextLength: conversationContext.length
    });

    // Classify message with conversation context for better follow-up detection
    const { data: classificationData, error: classificationError } = await supabase.functions.invoke('chat-query-classifier', {
      body: { 
        message, 
        conversationContext,
        lastAssistantMessage: lastAssistantMessage?.content
      }
    });

    if (classificationError) {
      console.error('[ChatService] Classification error:', classificationError);
      throw new Error(`Classification failed: ${classificationError.message}`);
    }

    if (!classificationData || !classificationData.category) {
      console.error('[ChatService] Invalid classification data:', classificationData);
      throw new Error('Classification service returned invalid data');
    }

    const classification = classificationData;
    
    console.log('[ChatService] Message classification:', classification);
    
    // Store classification data for inclusion in response
    const classificationMetadata = {
      category: classification.category,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
      useAllEntries: classification.useAllEntries
    };

    // Handle general mental health with conversational SOULo personality
    if (classification.category === 'GENERAL_MENTAL_HEALTH') {
      console.log('[ChatService] Handling general mental health question');
      
      const generalResponse = await handleGeneralQuestion(message, conversationContext, userId);
      return {
        content: generalResponse,
        role: 'assistant',
        analysis: {
          method: 'general_mental_health',
          classification: classificationMetadata
        }
      };
    }

    // Handle unrelated queries with random playful responses
    if (classification.category === 'UNRELATED') {
      console.log('[ChatService] Handling unrelated query');
      
      const unrelatedResponses = [
        "Oops! 🤖 I think my emotional intelligence wires got crossed with my general knowledge circuits there! I'm like a really enthusiastic therapist who only knows about feelings, journals, and the beautiful chaos of human emotions. Try asking me about your mood, your day, or that thing that's been bouncing around in your head! 🧠✨",
        "Ah, you've stumbled upon my one weakness! 😅 I'm basically a feelings expert who failed at everything else in AI school. I can help you decode your emotions, dive into your journal patterns, and figure out what your heart is trying to tell you... but ask me about the weather and I'll probably suggest you journal about how clouds make you feel! 🌤️💭",
        "Whoops! Looks like you've found the edge of my brain! 🤯 I'm like that friend who's AMAZING at deep 2am conversations about life but terrible at trivia night. I live for your thoughts, feelings, journal entries, and all things emotional wellbeing - that's where I absolutely shine! ✨ What's your heart been up to lately? 💛",
        "Haha, you caught me! I'm basically a one-trick pony, but it's a really GOOD trick! 🐴✨ Think of me as your personal feelings detective, journal whisperer, and emotional GPS all rolled into one. I can't help with that question, but I'd love to hear what's been stirring in your world today! 🌍💫"
      ];
      
      const randomResponse = unrelatedResponses[Math.floor(Math.random() * unrelatedResponses.length)];
      
      return {
        content: randomResponse,
        role: 'assistant'
      };
    }

    // For journal-specific questions, use enhanced database-aware dual-search conversational analysis
    console.log('[ChatService] Processing journal-specific question with enhanced database-aware dual-search SOULo');
    
    // Get current session for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      throw new Error('Authentication required');
    }


    // PHASE 1: Smart query routing based on complexity
    const contextFactors = {
      hasPersonalPronouns: /\b(i|me|my|mine|myself)\b/i.test(message),
      hasTimeReferences: /\b(last week|yesterday|this week|today|recently)\b/i.test(message),
      hasEmotionKeywords: /\b(feel|emotion|mood|happy|sad|angry|anxious)\b/i.test(message),
      conversationDepth: conversationContext.length,
      userPreferences: parameters.userPreferences
    };

    const routingResult = queryRouter.routeQuery(complexityAnalysis, contextFactors);
    console.log('[ChatService] Query routing:', {
      route: routingResult.primaryRoute.routeName,
      reason: routingResult.routingReason
    });

    // PHASE 2: Conversational flow analysis
    const flowRecommendation = flowManager.analyzeConversationalFlow(
      threadId,
      message,
      conversationContext
    );
    console.log('[ChatService] Flow analysis:', {
      mode: flowRecommendation.suggestedTone,
      length: flowRecommendation.suggestedResponseLength,
      urgency: flowRecommendation.urgencyLevel
    });

    // Get user timezone for accurate temporal queries
    let userTimezone = 'UTC';
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', userId)
        .single();
      
      if (profileData?.timezone) {
        userTimezone = profileData.timezone;
        console.log(`[ChatService] Using user timezone: ${userTimezone}`);
      } else {
        userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        console.log(`[ChatService] Using browser timezone: ${userTimezone}`);
      }
    } catch (error) {
      console.error('[ChatService] Error fetching user timezone:', error);
      userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    }

    // Get intelligent query plan with enhanced database-aware dual-search requirements
    const queryPlanResponse = await supabase.functions.invoke('smart-query-planner', {
      body: {
        message,
        userId,
        conversationContext,
        isFollowUp: isFollowUpMessage,
        preserveTopicContext: true,
        threadMetadata: {},
        requireDualSearch: true,
        requireDatabaseValidation: true, // Enhanced requirement for database-validated themes/emotions
        confidenceThreshold: 0.9,
        userTimezone // Add timezone to request body
      }
    });

    if (queryPlanResponse.error) {
      throw new Error(`Query planner error: ${queryPlanResponse.error.message}`);
    }

    const queryPlan = queryPlanResponse.data?.queryPlan || {};
    
    // Log database-aware dual-search enforcement
    if (queryPlan.searchConfidence <= 0.9) {
      console.log(`[ChatService] DATABASE-AWARE DUAL SEARCH ENFORCED - Confidence: ${queryPlan.searchConfidence} <= 90%`);
    }

    // PHASE 3: Optimize search strategy based on route and context
    const searchStrategy = queryRouter.optimizeSearchStrategy(routingResult.primaryRoute, {
      hasEntities: contextFactors.hasPersonalPronouns,
      hasEmotions: contextFactors.hasEmotionKeywords,
      hasThemes: /\b(work|relationship|health|goal|habit|stress)\b/i.test(message),
      timeConstrained: flowRecommendation.urgencyLevel === 'high' || flowRecommendation.urgencyLevel === 'crisis',
      userContext: parameters
    });

    // Use enhanced conversational RAG with optimized parameters
    const ragStartTime = Date.now();
    const ragResponse = await supabase.functions.invoke('chat-with-rag', {
      body: {
        message,
        userId,
        threadId,
        conversationContext,
        queryPlan,
        useAllEntries: queryPlan.useAllEntries || false,
        hasPersonalPronouns: queryPlan.hasPersonalPronouns || false,
        hasExplicitTimeReference: queryPlan.hasExplicitTimeReference || false,
        enforceDualSearch: queryPlan.searchConfidence <= 0.9,
        requireDatabaseValidation: true,
        themeFilters: queryPlan.themeFilters || [],
        emotionFilters: queryPlan.emotionFilters || [],
        threadMetadata: {},
        databaseAware: true,
        // PHASE 1 & 3: Pass optimization parameters
        optimizationConfig: {
          searchStrategy: searchStrategy.name,
          maxEntries: searchStrategy.maxEntries,
          timeout: searchStrategy.timeoutMs,
          complexityLevel: complexityAnalysis.complexityLevel,
          route: routingResult.primaryRoute.routeName
        },
        // PHASE 2 & 4: Pass flow recommendations
        flowConfig: {
          suggestedTone: flowRecommendation.suggestedTone,
          urgencyLevel: flowRecommendation.urgencyLevel,
          conversationMode: flowRecommendation.suggestedResponseLength
        }
      },
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    const ragExecutionTime = Date.now() - ragStartTime;

    if (ragResponse.error) {
      // Record failed performance
      queryRouter.recordPerformance(routingResult.primaryRoute.routeName, ragExecutionTime, false);
      throw new Error(`Chat RAG error: ${ragResponse.error.message}`);
    }

    // PHASE 4: Analyze emotional context for response optimization
    const journalEmotions = ragResponse.data.referenceEntries?.[0]?.emotions || {};
    const emotionalContext = analyzeEmotionalContext(message, journalEmotions, conversationContext);

    // PHASE 2: Optimize response based on complexity and flow
    const responseConfig = optimizeResponseLength(
      ragResponse.data.response,
      complexityAnalysis.complexityLevel,
      {
        isFirstMessage: conversationContext.length === 0,
        isFollowUp: conversationContext.length > 0,
        previousTopics: [],
        userEngagementLevel: 'medium', // Could be enhanced with engagement tracking
        conversationDepth: conversationContext.length,
        lastResponseType: 'informational'
      },
      parameters.userPreferences
    );

    // Record successful performance
    queryRouter.recordPerformance(routingResult.primaryRoute.routeName, ragExecutionTime, true);

    const totalExecutionTime = Date.now() - startTime;
    console.log('[ChatService] Optimization summary:', {
      totalTime: totalExecutionTime,
      ragTime: ragExecutionTime,
      route: routingResult.primaryRoute.routeName,
      complexity: complexityAnalysis.complexityLevel,
      responseLength: responseConfig.preferredStyle,
      emotionalTone: emotionalContext.suggestedTone
    });

    const finalResponse = ragResponse.data.response || ragResponse.data;

    // PHASE 2: Save conversation state after successful processing
    await conversationPersistence.saveConversationState(
      message,
      finalResponse,
      'new_query',
      {
        complexityLevel: complexityAnalysis.complexityLevel,
        route: routingResult.primaryRoute.routeName,
        emotionalTone: emotionalContext.suggestedTone
      }
    );

    return {
      content: finalResponse,
      role: 'assistant',
      references: ragResponse.data.references,
      analysis: {
        ...ragResponse.data.analysis,
        databaseValidated: true,
        enhancedThemeEmotionAwareness: true,
        // OPTIMIZATION METADATA
        optimization: {
          complexity: complexityAnalysis,
          routing: routingResult,
          searchStrategy,
          responseConfig,
          emotionalContext,
          flowRecommendation,
          performance: {
            totalTime: totalExecutionTime,
            ragTime: ragExecutionTime,
            route: routingResult.primaryRoute.routeName
          }
        },
        classification: classificationMetadata
      },
      hasNumericResult: ragResponse.data.hasNumericResult
    };

  } catch (error) {
    console.error('[ChatService] Error processing message:', error);
    return {
      content: `I'm having trouble understanding that right now. Could you try rephrasing your question? I'm here to help you explore your emotional patterns and wellbeing using both validated themes and emotional data from our comprehensive database.`,
      role: 'error'
    };
  }
}

async function handleGeneralQuestion(message: string, conversationContext: any[] = [], userId: string): Promise<string> {
  console.log('[ChatService] Generating conversational response for:', message);
  
  // Get user timezone for time-aware responses
  let userTimezone = 'UTC';
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single();
    
    if (profileData?.timezone) {
      userTimezone = profileData.timezone;
    } else {
      userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    }
  } catch (error) {
    console.error('[ChatService] Error fetching user timezone for general chat:', error);
    userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }
  
  try {
    // PHASE 1: Pass conversation context and timezone to general chat for better follow-ups
    const { data, error } = await supabase.functions.invoke('general-mental-health-chat', {
      body: { 
        message,
        conversationContext: conversationContext.slice(-3), // Last 3 messages for context
        userTimezone // Add timezone for time-aware responses
      }
    });

    if (error) {
      console.error('[ChatService] General chat error:', error);
      return getConversationalFallback(message, conversationContext);
    }

    return data.response || getConversationalFallback(message, conversationContext);
  } catch (error) {
    console.error('[ChatService] General chat exception:', error);
    return getConversationalFallback(message, conversationContext);
  }
}

function getConversationalFallback(message: string, conversationContext: any[] = []): string {
  const lowerMessage = message.toLowerCase();
  
  // PHASE 1: Check for football/sports follow-up context
  const lastAssistantMessage = conversationContext
    .slice()
    .reverse()
    .find(msg => msg.role === 'assistant');
    
  if (lastAssistantMessage && /\b(sport|football|activity|exercise|physical)\b/i.test(lastAssistantMessage.content)) {
    if (lowerMessage.includes('football')) {
      return `That's exciting that you're interested in starting football! 🏈 

Physical activity like football can be amazing for both your mental and physical wellbeing. Here are some thoughts on getting started:

• **Start gradually** - maybe join a beginner-friendly league or casual pickup games
• **Focus on fun first** - the enjoyment factor will keep you motivated
• **Listen to your body** - proper warm-up and recovery are key
• **Connect with others** - team sports are great for building social connections

Football can be fantastic for:
- Building confidence through skill development
- Managing stress through physical activity  
- Creating social bonds with teammates
- Setting and achieving goals

Have you thought about what type of football you'd like to try? Touch football, flag football, or full contact? Each has different benefits and requirements!`;
    }
  }
  
  if (lowerMessage.includes('confident')) {
    return `Building confidence is such a personal journey, and I love that you're thinking about it! 

Some gentle approaches that many people find helpful:
• **Start small** - celebrate tiny wins to build momentum
• **Practice self-compassion** - treat yourself like you would a good friend
• **Notice your strengths** - what are you naturally good at?
• **Challenge that inner critic** - would you talk to a friend the way you talk to yourself?

I'd love to help you understand your personal confidence patterns! If you're journaling with SOULo, try asking me something like "When do I feel most confident?" and I can analyze your entries for personalized insights using both your themes and emotional patterns.

What aspects of confidence feel most important to you right now?`;
  }
  
  if (lowerMessage.includes('anxiety') || lowerMessage.includes('stress')) {
    return `I hear you, and anxiety can feel so overwhelming. You're not alone in this.

Some gentle strategies that often help:
• **Breathe mindfully** - try the 4-7-8 technique (inhale 4, hold 7, exhale 8)
• **Ground yourself** - name 5 things you can see, 4 you can hear, 3 you can touch
• **Move your body** - even a short walk can shift your energy
• **Be kind to yourself** - anxiety is tough, and you're doing your best

If you're using SOULo for journaling, I can help you understand your personal anxiety patterns and themes. Try asking me "What triggers my anxiety?" or "How am I handling stress?" and I'll analyze your entries for insights.

What would feel most helpful for you right now?`;
  }

  return `I'm here to support you with whatever's on your mind about emotional wellbeing and mental health. 

I can share general insights about topics like:
• Managing stress and anxiety
• Building confidence and self-esteem  
• Developing healthy habits and routines
• Understanding emotions and mood patterns
• Self-care and mindfulness practices

**For personalized insights,** I can also analyze your journal entries to understand your unique patterns and theme-emotion relationships. Just ask me something personal like "How am I doing?" or "What makes me happiest?" and I'll dive into your journaling data using both thematic and emotional analysis.

What would you like to explore together?`;
}
