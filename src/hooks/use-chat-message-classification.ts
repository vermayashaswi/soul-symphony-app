
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export enum QueryCategory {
  JOURNAL_SPECIFIC = 'JOURNAL_SPECIFIC',
  JOURNAL_SPECIFIC_NEEDS_CLARIFICATION = 'JOURNAL_SPECIFIC_NEEDS_CLARIFICATION',
  GENERAL_MENTAL_HEALTH = 'GENERAL_MENTAL_HEALTH'
}

interface MessageClassification {
  category: QueryCategory;
  confidence: number;
  reasoning: string;
  useAllEntries?: boolean; // NEW: Flag for using all entries vs time-constrained
  isLoading: boolean;
  error: string | null;
}

export function useChatMessageClassification() {
  const [classification, setClassification] = useState<MessageClassification>({
    category: QueryCategory.GENERAL_MENTAL_HEALTH,
    confidence: 0,
    reasoning: '',
    useAllEntries: false,
    isLoading: false,
    error: null
  });

  /**
   * Enhanced message classification with prioritized personal pronoun support
   */
  const classifyMessage = useCallback(async (message: string, conversationContext: any[] = []) => {
    if (!message?.trim()) {
      return {
        category: QueryCategory.GENERAL_MENTAL_HEALTH,
        confidence: 0,
        reasoning: 'Empty message',
        useAllEntries: false
      };
    }

    setClassification(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Classification Hook] Classification attempt ${attempt}/${maxRetries} for message:`, message);
        
        // Use the enhanced chat-query-classifier edge function
        const { data, error } = await supabase.functions.invoke('chat-query-classifier', {
          body: { message, conversationContext }
        });

        if (error) throw error;
        
        if (data) {
          const result = {
            category: data.category as QueryCategory,
            confidence: data.confidence || 0.8,
            reasoning: data.reasoning || 'GPT-based classification',
            useAllEntries: data.useAllEntries || false
          };
          
          console.log("[Classification Hook] Classification successful:", result);
          
          setClassification({
            ...result,
            isLoading: false,
            error: null
          });
          
          return result;
        }
        
        throw new Error('No data received from classification service');
      } catch (error: any) {
        lastError = error;
        console.error(`[Classification Hook] Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`[Classification Hook] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed - return error state
    const errorMessage = lastError?.message || 'Classification service unavailable';
    console.error("[Classification Hook] All classification attempts failed:", errorMessage);
    
    const errorResult = {
      category: QueryCategory.GENERAL_MENTAL_HEALTH,
      confidence: 0,
      reasoning: 'Classification service unavailable - please try again',
      useAllEntries: false
    };
    
    setClassification({
      ...errorResult,
      isLoading: false,
      error: errorMessage
    });
    
    return errorResult;
  }, []);

  return {
    classifyMessage,
    classification
  };
}
