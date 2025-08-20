import { supabase } from '@/integrations/supabase/client';

// Interface for classification data
export interface ClassificationData {
  category: string;
  confidence: number;
  reasoning: string;
  useAllEntries: boolean;
}

// Interface for classification analysis
export interface ClassificationAnalysis {
  messageId: string;
  content: string;
  sender: string;
  classification?: ClassificationData;
  created_at: string;
}

// Interface for thread classification statistics
export interface ThreadClassificationStats {
  threadId: string;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  classifications: {
    JOURNAL_SPECIFIC: number;
    JOURNAL_SPECIFIC_NEEDS_CLARIFICATION: number;
    GENERAL_MENTAL_HEALTH: number;
    UNRELATED: number;
  };
  averageConfidence: number;
}

/**
 * Get classification data for a specific message
 */
export const getMessageClassification = async (
  messageId: string,
  userId: string
): Promise<ClassificationAnalysis | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        content,
        sender,
        analysis_data,
        created_at,
        chat_threads!inner(user_id)
      `)
      .eq('id', messageId)
      .eq('chat_threads.user_id', userId)
      .single();

    if (error || !data) {
      console.error('[getMessageClassification] Error fetching message:', error);
      return null;
    }

    const analysisData = data.analysis_data as any;
    const classification = analysisData?.classification;

    return {
      messageId: data.id,
      content: data.content,
      sender: data.sender,
      classification: classification ? {
        category: classification.category,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        useAllEntries: classification.useAllEntries
      } : undefined,
      created_at: data.created_at
    };
  } catch (error) {
    console.error('[getMessageClassification] Exception:', error);
    return null;
  }
};

/**
 * Get classification statistics for a thread
 */
export const getThreadClassificationStats = async (
  threadId: string,
  userId: string
): Promise<ThreadClassificationStats | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        sender,
        analysis_data,
        chat_threads!inner(user_id)
      `)
      .eq('thread_id', threadId)
      .eq('chat_threads.user_id', userId);

    if (error || !data) {
      console.error('[getThreadClassificationStats] Error fetching messages:', error);
      return null;
    }

    const stats: ThreadClassificationStats = {
      threadId,
      totalMessages: data.length,
      userMessages: data.filter(m => m.sender === 'user').length,
      assistantMessages: data.filter(m => m.sender === 'assistant').length,
      classifications: {
        JOURNAL_SPECIFIC: 0,
        JOURNAL_SPECIFIC_NEEDS_CLARIFICATION: 0,
        GENERAL_MENTAL_HEALTH: 0,
        UNRELATED: 0
      },
      averageConfidence: 0
    };

    let totalConfidence = 0;
    let classificationCount = 0;

    data.forEach(message => {
      const analysisData = message.analysis_data as any;
      const classification = analysisData?.classification;
      if (classification) {
        const category = classification.category as keyof typeof stats.classifications;
        if (category in stats.classifications) {
          stats.classifications[category]++;
        }
        
        if (typeof classification.confidence === 'number') {
          totalConfidence += classification.confidence;
          classificationCount++;
        }
      }
    });

    stats.averageConfidence = classificationCount > 0 ? totalConfidence / classificationCount : 0;

    return stats;
  } catch (error) {
    console.error('[getThreadClassificationStats] Exception:', error);
    return null;
  }
};

/**
 * Get all messages with classification data for a thread
 */
export const getThreadMessagesWithClassification = async (
  threadId: string,
  userId: string
): Promise<ClassificationAnalysis[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        content,
        sender,
        analysis_data,
        created_at,
        chat_threads!inner(user_id)
      `)
      .eq('thread_id', threadId)
      .eq('chat_threads.user_id', userId)
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.error('[getThreadMessagesWithClassification] Error fetching messages:', error);
      return [];
    }

    return data.map(message => {
      const analysisData = message.analysis_data as any;
      const classification = analysisData?.classification;
      
      return {
        messageId: message.id,
        content: message.content,
        sender: message.sender,
        classification: classification ? {
          category: classification.category,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
          useAllEntries: classification.useAllEntries
        } : undefined,
        created_at: message.created_at
      };
    });
  } catch (error) {
    console.error('[getThreadMessagesWithClassification] Exception:', error);
    return [];
  }
};

/**
 * Update user message with classification data after processing
 * This is used when classification happens after the message is initially saved
 */
export const updateUserMessageClassification = async (
  messageId: string,
  classification: ClassificationData,
  userId: string
): Promise<boolean> => {
  try {
    // First verify the message belongs to the user and is a user message
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select(`
        id,
        sender,
        chat_threads!inner(user_id)
      `)
      .eq('id', messageId)
      .eq('sender', 'user')
      .eq('chat_threads.user_id', userId)
      .single();

    if (messageError || !message) {
      console.error('[updateUserMessageClassification] Message not found or access denied:', messageError);
      return false;
    }

    // Update with classification data
    const { error } = await supabase
      .from('chat_messages')
      .update({
        analysis_data: {
          classification: {
            category: classification.category,
            confidence: classification.confidence,
            reasoning: classification.reasoning,
            useAllEntries: classification.useAllEntries
          }
        } as any
      })
      .eq('id', messageId);

    if (error) {
      console.error('[updateUserMessageClassification] Failed to update message:', error);
      return false;
    }

    console.log('[updateUserMessageClassification] Successfully updated message with classification');
    return true;
  } catch (error) {
    console.error('[updateUserMessageClassification] Exception:', error);
    return false;
  }
};