
import { QueryTypes } from '@/utils/chat/queryAnalyzer';
import { useChatMessageClassification, QueryCategory } from '@/hooks/use-chat-message-classification';
import { supabase } from '@/integrations/supabase/client';

interface ChatResponse {
  content: string;
  role: 'assistant' | 'error';
  references?: any[];
  analysis?: any;
  hasNumericResult?: boolean;
  isInteractive?: boolean;
  interactiveOptions?: any[];
}

export async function processChatMessage(
  message: string,
  userId: string,
  queryTypes: QueryTypes,
  threadId: string,
  usePersonalContext: boolean = false,
  parameters: Record<string, any> = {}
): Promise<ChatResponse> {
  try {
    console.log('[ChatService] Processing message:', message);
    
    // First classify the message to determine if it needs journal analysis
    const { data: classificationData, error: classificationError } = await supabase.functions.invoke('chat-query-classifier', {
      body: { message, conversationContext: [] }
    });

    if (classificationError) {
      console.error('[ChatService] Classification error:', classificationError);
    }

    const classification = classificationData || { category: 'JOURNAL_SPECIFIC', shouldUseJournal: true };
    console.log('[ChatService] Message classification:', classification);

    // Handle general mental health questions without journal analysis
    if (classification.category === 'GENERAL_MENTAL_HEALTH' || classification.category === 'CONVERSATIONAL') {
      console.log('[ChatService] Handling general question without journal analysis');
      
      const generalResponse = await handleGeneralQuestion(message);
      return {
        content: generalResponse,
        role: 'assistant'
      };
    }

    // For journal-specific questions, proceed with the existing pipeline
    console.log('[ChatService] Processing journal-specific question');
    
    // Get current session for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      throw new Error('Authentication required');
    }

    // Build conversation context
    const { data: previousMessages } = await supabase
      .from('chat_messages')
      .select('content, sender, role, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(5);

    const conversationContext = previousMessages ? 
      [...previousMessages].reverse().map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.created_at
      })) : [];

    // Call smart-query-planner for journal analysis
    const queryPlanResponse = await supabase.functions.invoke('smart-query-planner', {
      body: {
        message,
        userId,
        conversationContext,
        isFollowUp: conversationContext.length > 0,
        preserveTopicContext: false,
        threadMetadata: {},
        isAnalysisFollowUp: false
      }
    });

    if (queryPlanResponse.error) {
      throw new Error(`Query planner error: ${queryPlanResponse.error.message}`);
    }

    const queryPlan = queryPlanResponse.data?.queryPlan || {};

    // Call chat-with-rag for journal analysis
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
        threadMetadata: {}
      },
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (ragResponse.error) {
      throw new Error(`Chat RAG error: ${ragResponse.error.message}`);
    }

    return {
      content: ragResponse.data.response || ragResponse.data,
      role: 'assistant',
      references: ragResponse.data.references,
      analysis: ragResponse.data.analysis,
      hasNumericResult: ragResponse.data.hasNumericResult
    };

  } catch (error) {
    console.error('[ChatService] Error processing message:', error);
    return {
      content: `I apologize, but I encountered an error processing your request: ${error.message}. Please try again.`,
      role: 'error'
    };
  }
}

async function handleGeneralQuestion(message: string): Promise<string> {
  console.log('[ChatService] Generating general response for:', message);
  
  // Use OpenAI directly for general mental health questions
  try {
    const { data, error } = await supabase.functions.invoke('general-mental-health-chat', {
      body: { message }
    });

    if (error) {
      console.error('[ChatService] General chat error:', error);
      return getGeneralMentalHealthFallback(message);
    }

    return data.response || getGeneralMentalHealthFallback(message);
  } catch (error) {
    console.error('[ChatService] General chat exception:', error);
    return getGeneralMentalHealthFallback(message);
  }
}

function getGeneralMentalHealthFallback(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('confident')) {
    return `## Building Confidence: General Strategies

**Practical Ways to Become More Confident:**

- **Practice self-compassion** - Treat yourself with the same kindness you'd show a good friend
- **Set small, achievable goals** - Build momentum with consistent small wins
- **Challenge negative self-talk** - Notice and reframe harsh inner criticism
- **Focus on your strengths** - Make a list of things you're good at and review it regularly
- **Step outside your comfort zone gradually** - Take on challenges that stretch but don't overwhelm you
- **Improve your posture and body language** - Stand tall, make eye contact, and take up space
- **Learn new skills** - Competence builds confidence naturally
- **Exercise regularly** - Physical activity boosts mood and self-esteem
- **Practice mindfulness** - Stay present instead of worrying about future judgments

**Remember:** Confidence is built through consistent practice and self-acceptance, not perfection. Start with one or two strategies that resonate with you and build from there.

Would you like me to analyze your personal confidence patterns from your journal entries? Just ask something like "How can I become more confident?" to get personalized insights.`;
  }
  
  if (lowerMessage.includes('anxiety') || lowerMessage.includes('stress')) {
    return `## Managing Anxiety and Stress: General Approaches

**Evidence-Based Strategies:**

- **Deep breathing exercises** - Practice 4-7-8 breathing or box breathing
- **Progressive muscle relaxation** - Tense and release muscle groups systematically
- **Mindfulness meditation** - Focus on the present moment without judgment
- **Regular exercise** - Physical activity reduces stress hormones
- **Maintain good sleep hygiene** - Aim for 7-9 hours of quality sleep
- **Limit caffeine and alcohol** - These can worsen anxiety symptoms
- **Connect with others** - Share your feelings with trusted friends or family
- **Practice grounding techniques** - Use the 5-4-3-2-1 sensory method
- **Consider professional help** - Therapy can provide personalized coping strategies

**When to seek professional help:** If anxiety significantly impacts your daily life, work, or relationships.

For personalized insights about your stress patterns, I can analyze your journal entries if you'd like!`;
  }

  return `I'd be happy to help with general mental health information! However, for the most helpful response, could you be more specific about what you're looking for?

**I can provide general information about:**
- Stress and anxiety management
- Building confidence and self-esteem  
- Improving mood and emotional well-being
- Sleep and lifestyle factors
- Mindfulness and coping strategies

**For personalized insights,** I can also analyze your journal entries to understand your unique patterns and provide tailored advice. Just ask a more personal question like "How can I..." or "What helps me..." and I'll look at your journal data.

What specific aspect of mental health would you like to explore?`;
}
