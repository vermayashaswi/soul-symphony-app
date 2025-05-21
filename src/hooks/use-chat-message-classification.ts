
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { enhancedQueryClassification, QueryCategory } from '@/utils/chat/messageClassifier';

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
    category: QueryCategory.GENERAL,
    confidence: 0,
    reasoning: '',
    shouldUseJournal: false,
    isLoading: false,
    error: null
  });

  /**
   * Classify a message using local utilities and edge function
   */
  const classifyMessage = useCallback(async (message: string) => {
    if (!message?.trim()) {
      return {
        category: QueryCategory.GENERAL,
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
      // First, do client-side classification using our utility
      const localClassification = enhancedQueryClassification(message);
      
      // Then try to get server-side classification for better accuracy
      try {
        const { data, error } = await supabase.functions.invoke('chat-query-classifier', {
          body: { message }
        });

        if (error) throw error;
        
        if (data) {
          // Use server classification with local as backup
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
      } catch (serverError) {
        console.warn('Failed to get server classification, using local only:', serverError);
      }
      
      // Fall back to local classification
      const localResult = {
        category: localClassification.category,
        confidence: localClassification.confidence,
        reasoning: localClassification.reasoning,
        shouldUseJournal: localClassification.category === QueryCategory.JOURNAL_SPECIFIC || 
                         localClassification.forceJournalSpecific
      };
      
      setClassification({
        ...localResult,
        isLoading: false,
        error: null
      });
      
      return localResult;
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error classifying message';
      
      setClassification({
        category: QueryCategory.GENERAL,
        confidence: 0,
        reasoning: 'Error in classification',
        shouldUseJournal: false,
        isLoading: false,
        error: errorMessage
      });
      
      return {
        category: QueryCategory.GENERAL,
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
