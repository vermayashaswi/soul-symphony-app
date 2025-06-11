
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
    
    // First classify the message to determine the response approach
    const { data: classificationData, error: classificationError } = await supabase.functions.invoke('chat-query-classifier', {
      body: { message, conversationContext: [] }
    });

    if (classificationError) {
      console.error('[ChatService] Classification error:', classificationError);
    }

    const classification = classificationData || { category: 'JOURNAL_SPECIFIC', shouldUseJournal: true };
    console.log('[ChatService] Message classification:', classification);

    // Handle general mental health questions with conversational flow
    if (classification.category === 'GENERAL_MENTAL_HEALTH' || classification.category === 'CONVERSATIONAL') {
      console.log('[ChatService] Handling general/conversational question');
      
      const generalResponse = await handleGeneralQuestion(message);
      return {
        content: generalResponse,
        role: 'assistant'
      };
    }

    // For journal-specific questions, proceed with enhanced analysis
    console.log('[ChatService] Processing journal-specific question with conversational approach');
    
    // Get current session for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      throw new Error('Authentication required');
    }

    // Build conversation context for natural flow
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

    // Call smart-query-planner for intelligent analysis
    const queryPlanResponse = await supabase.functions.invoke('smart-query-planner', {
      body: {
        message,
        userId,
        conversationContext,
        isFollowUp: conversationContext.length > 0,
        preserveTopicContext: true,
        threadMetadata: {},
        isAnalysisFollowUp: false
      }
    });

    if (queryPlanResponse.error) {
      throw new Error(`Query planner error: ${queryPlanResponse.error.message}`);
    }

    const queryPlan = queryPlanResponse.data?.queryPlan || {};

    // Call chat-with-rag for conversational journal analysis
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
      content: `I'm having trouble understanding that right now. Could you try rephrasing your question? I'm here to help you explore your emotional patterns and wellbeing.`,
      role: 'error'
    };
  }
}

async function handleGeneralQuestion(message: string): Promise<string> {
  console.log('[ChatService] Generating conversational response for:', message);
  
  try {
    const { data, error } = await supabase.functions.invoke('general-mental-health-chat', {
      body: { message }
    });

    if (error) {
      console.error('[ChatService] General chat error:', error);
      return getConversationalFallback(message);
    }

    return data.response || getConversationalFallback(message);
  } catch (error) {
    console.error('[ChatService] General chat exception:', error);
    return getConversationalFallback(message);
  }
}

function getConversationalFallback(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('confident')) {
    return `Building confidence is such a personal journey, and I love that you're thinking about it! 

Some gentle approaches that many people find helpful:
• **Start small** - celebrate tiny wins to build momentum
• **Practice self-compassion** - treat yourself like you would a good friend
• **Notice your strengths** - what are you naturally good at?
• **Challenge that inner critic** - would you talk to a friend the way you talk to yourself?

I'd love to help you understand your personal confidence patterns! If you're journaling with SOULo, try asking me something like "When do I feel most confident?" and I can analyze your entries for personalized insights about what specifically boosts your confidence.

What aspects of confidence feel most important to you right now?`;
  }
  
  if (lowerMessage.includes('anxiety') || lowerMessage.includes('stress')) {
    return `I hear you, and anxiety can feel so overwhelming. You're not alone in this.

Some gentle strategies that often help:
• **Breathe mindfully** - try the 4-7-8 technique (inhale 4, hold 7, exhale 8)
• **Ground yourself** - name 5 things you can see, 4 you can hear, 3 you can touch
• **Move your body** - even a short walk can shift your energy
• **Be kind to yourself** - anxiety is tough, and you're doing your best

If you're using SOULo for journaling, I can help you understand your personal anxiety patterns. Try asking me "What triggers my anxiety?" or "How am I handling stress?" and I'll analyze your entries for insights.

What would feel most helpful for you right now?`;
  }

  return `I'm here to support you with whatever's on your mind about emotional wellbeing and mental health. 

I can share general insights about topics like:
• Managing stress and anxiety
• Building confidence and self-esteem  
• Developing healthy habits and routines
• Understanding emotions and mood patterns
• Self-care and mindfulness practices

**For personalized insights,** I can also analyze your journal entries to understand your unique patterns. Just ask me something personal like "How am I doing?" or "What makes me happiest?" and I'll dive into your journaling data.

What would you like to explore together?`;
}
