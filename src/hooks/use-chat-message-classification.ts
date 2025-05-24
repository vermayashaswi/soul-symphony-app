
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
  useAllEntries?: boolean; // NEW: Flag for using all entries vs time-constrained
  isLoading: boolean;
  error: string | null;
}

export function useChatMessageClassification() {
  const [classification, setClassification] = useState<MessageClassification>({
    category: QueryCategory.CONVERSATIONAL,
    confidence: 0,
    reasoning: '',
    shouldUseJournal: false,
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
        category: QueryCategory.CONVERSATIONAL,
        confidence: 0,
        reasoning: 'Empty message',
        shouldUseJournal: false,
        useAllEntries: false
      };
    }

    setClassification(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      console.log("[Classification Hook] Classifying message with enhanced personal pronoun prioritization:", message);
      
      // Use the enhanced chat-query-classifier edge function
      const { data, error } = await supabase.functions.invoke('chat-query-classifier', {
        body: { message, conversationContext }
      });

      if (error) throw error;
      
      if (data) {
        const result = {
          category: data.category as QueryCategory,
          confidence: data.confidence,
          reasoning: data.reasoning,
          shouldUseJournal: data.shouldUseJournal || data.category === 'JOURNAL_SPECIFIC',
          useAllEntries: data.useAllEntries || false // NEW: Support for all entries flag
        };
        
        console.log("[Classification Hook] Enhanced classification result:", result);
        
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
      
      console.error("[Classification Hook] Classification error:", errorMessage);
      
      // Enhanced fallback for personal pronoun detection with HIGHEST PRIORITY
      const personalPronounPattern = /\b(i|me|my|mine|myself|am i|do i|how am i|what makes me|how do i|what about me)\b/i;
      const hasPersonalPronouns = personalPronounPattern.test(message.toLowerCase());
      const hasTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night)\b/i.test(message.toLowerCase());
      
      const fallbackResult = {
        category: hasPersonalPronouns ? QueryCategory.JOURNAL_SPECIFIC : QueryCategory.CONVERSATIONAL,
        confidence: hasPersonalPronouns ? 0.9 : 0.3,
        reasoning: hasPersonalPronouns ? 'PERSONAL PRONOUNS DETECTED (fallback) - automatically classified as journal-specific' : 'Error in classification (fallback)',
        shouldUseJournal: hasPersonalPronouns,
        useAllEntries: hasPersonalPronouns && !hasTimeReference // Use all entries if personal pronouns but no time reference
      };
      
      setClassification({
        ...fallbackResult,
        isLoading: false,
        error: errorMessage
      });
      
      return fallbackResult;
    }
  }, []);

  return {
    classifyMessage,
    classification
  };
}
