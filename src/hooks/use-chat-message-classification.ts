
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export enum QueryCategory {
  JOURNAL_SPECIFIC = 'JOURNAL_SPECIFIC',
  GENERAL_MENTAL_HEALTH = 'GENERAL_MENTAL_HEALTH', 
  CONVERSATIONAL = 'CONVERSATIONAL'
}

interface MessageClassification {
  category: QueryCategory;
  confidence: number;
  reasoning: string;
  shouldUseJournal: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useChatMessageClassification() {
  const [classification, setClassification] = useState<MessageClassification>({
    category: QueryCategory.CONVERSATIONAL,
    confidence: 0,
    reasoning: '',
    shouldUseJournal: false,
    isLoading: false,
    error: null
  });

  /**
   * Classify a message using only GPT-based server-side classification
   */
  const classifyMessage = useCallback(async (message: string, conversationContext: any[] = []) => {
    if (!message?.trim()) {
      return {
        category: QueryCategory.CONVERSATIONAL,
        confidence: 0,
        reasoning: 'Empty message',
        shouldUseJournal: false
      };
    }

    setClassification(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      // Use only server-side GPT classification
      const { data, error } = await supabase.functions.invoke('chat-query-classifier', {
        body: { message, conversationContext }
      });

      if (error) throw error;
      
      if (data) {
        const result = {
          category: data.category as QueryCategory,
          confidence: data.confidence,
          reasoning: data.reasoning,
          shouldUseJournal: data.shouldUseJournal || data.category === 'JOURNAL_SPECIFIC'
        };
        
        setClassification({
          ...result,
          isLoading: false,
          error: null
        });
        
        return result;
      }
      
      throw new Error('No data received from classification service');
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error classifying message';
      
      setClassification({
        category: QueryCategory.CONVERSATIONAL,
        confidence: 0,
        reasoning: 'Error in classification',
        shouldUseJournal: false,
        isLoading: false,
        error: errorMessage
      });
      
      return {
        category: QueryCategory.CONVERSATIONAL,
        confidence: 0,
        reasoning: 'Error in classification',
        shouldUseJournal: false
      };
    }
  }, []);

  return {
    classifyMessage,
    classification
  };
}
