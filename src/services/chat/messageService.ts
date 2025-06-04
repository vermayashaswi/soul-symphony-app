
import { supabase } from '@/integrations/supabase/client';
import { ServiceChatMessage, ChatThread } from './types';

export interface MessageServiceResult {
  success: boolean;
  message?: ServiceChatMessage;
  error?: string;
  threadId?: string;
}

export const sendMessage = async (
  message: string,
  threadId: string | null,
  userId: string,
  conversationContext: any[] = []
): Promise<MessageServiceResult> => {
  try {
    console.log('[MessageService] Processing message through intelligent pipeline');
    
    // Create thread if it doesn't exist
    let currentThreadId = threadId;
    if (!currentThreadId) {
      const { data: newThread, error: threadError } = await supabase
        .from('chat_threads')
        .insert({
          user_id: userId,
          title: 'New Conversation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (threadError) throw threadError;
      currentThreadId = newThread.id;
    }

    // Store user message
    const { data: userMessage, error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: currentThreadId,
        content: message,
        sender: 'user',
        role: 'user',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (userMessageError) throw userMessageError;

    // Set processing status
    await supabase
      .from('chat_threads')
      .update({ processing_status: 'processing' })
      .eq('id', currentThreadId);

    try {
      // Step 1: Classify the query
      console.log('[MessageService] Step 1: Classifying query');
      const { data: classificationData, error: classificationError } = await supabase.functions
        .invoke('chat-query-classifier', {
          body: { 
            message,
            conversationContext: conversationContext.slice(-3)
          }
        });

      if (classificationError) throw classificationError;

      const classification = classificationData;
      console.log('[MessageService] Classification result:', classification);

      let response: string;
      let analysisData: any = {
        classification: classification,
        pipeline: 'intelligent'
      };

      if (classification.category === 'JOURNAL_SPECIFIC' && classification.shouldUseJournal) {
        // Step 2: Create intelligent query plan
        console.log('[MessageService] Step 2: Creating intelligent query plan');
        const { data: planData, error: planError } = await supabase.functions
          .invoke('intelligent-query-planner', {
            body: {
              message,
              userId,
              conversationContext,
              threadId: currentThreadId,
              messageId: userMessage.id
            }
          });

        if (planError) throw planError;

        // Step 3: Execute search orchestration
        console.log('[MessageService] Step 3: Executing search orchestration');
        const { data: searchData, error: searchError } = await supabase.functions
          .invoke('gpt-search-orchestrator', {
            body: {
              queryPlan: planData.queryPlan,
              originalQuery: message,
              userId,
              userContext: planData.userContext,
              conversationContext
            }
          });

        if (searchError) throw searchError;

        // Step 4: Synthesize intelligent response
        console.log('[MessageService] Step 4: Synthesizing response');
        const { data: responseData, error: responseError } = await supabase.functions
          .invoke('gpt-response-synthesizer', {
            body: {
              originalQuery: message,
              searchResults: searchData.results,
              aggregations: searchData.aggregations,
              queryPlan: planData.queryPlan,
              conversationContext,
              userContext: planData.userContext,
              contextualInsights: searchData.contextualInsights
            }
          });

        if (responseError) throw responseError;

        response = responseData.response;
        analysisData = {
          ...analysisData,
          queryPlan: planData.queryPlan,
          searchResults: searchData.results?.length || 0,
          enhancedFeatures: responseData.enhancedFeatures,
          references: responseData.references
        };

      } else {
        // Handle general mental health or conversational queries
        console.log('[MessageService] Handling general query');
        const { data: generalData, error: generalError } = await supabase.functions
          .invoke('general-mental-health-chat', {
            body: {
              message,
              conversationContext: conversationContext.slice(-5)
            }
          });

        if (generalError) throw generalError;

        response = generalData.response;
      }

      // Store AI response
      const { data: aiMessage, error: aiMessageError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: currentThreadId,
          content: response,
          sender: 'assistant',
          role: 'assistant',
          analysis_data: analysisData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (aiMessageError) throw aiMessageError;

      // Update thread status and timestamp
      await supabase
        .from('chat_threads')
        .update({ 
          processing_status: 'idle',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentThreadId);

      console.log('[MessageService] Intelligent pipeline completed successfully');

      return {
        success: true,
        message: aiMessage,
        threadId: currentThreadId
      };

    } catch (processingError) {
      console.error('[MessageService] Processing error:', processingError);
      
      // Reset processing status
      await supabase
        .from('chat_threads')
        .update({ processing_status: 'idle' })
        .eq('id', currentThreadId);

      throw processingError;
    }

  } catch (error) {
    console.error('[MessageService] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send message'
    };
  }
};

export const getThreadMessages = async (threadId: string): Promise<ServiceChatMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[MessageService] Error fetching messages:', error);
    return [];
  }
};

export const getUserThreads = async (userId: string): Promise<ChatThread[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[MessageService] Error fetching threads:', error);
    return [];
  }
};
