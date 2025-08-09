
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export enum QueryCategory {
  JOURNAL_SPECIFIC = 'JOURNAL_SPECIFIC',
  JOURNAL_SPECIFIC_NEEDS_CLARIFICATION = 'JOURNAL_SPECIFIC_NEEDS_CLARIFICATION',
  GENERAL_MENTAL_HEALTH = 'GENERAL_MENTAL_HEALTH', 
  UNRELATED = 'UNRELATED'
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
      
      // Enhanced fallback for personal pronoun detection with clarification for bare emotions
      const text = message.toLowerCase().trim();
      const personalPronounPattern = /\b(i|me|my|mine|myself|am i|do i|how am i|what makes me|how do i|what about me)\b/i;
      const hasPersonalPronouns = personalPronounPattern.test(text);
      const hasTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night)\b/i.test(text);
      const isBareEmotion = /^(i\s*(?:am|'m)\s+\w+|i\s*feel\s+\w+|feeling\s+\w+)$/i.test(text);
      
      const inferredCategory = hasPersonalPronouns
        ? (isBareEmotion && !hasTimeReference ? QueryCategory.JOURNAL_SPECIFIC_NEEDS_CLARIFICATION : QueryCategory.JOURNAL_SPECIFIC)
        : QueryCategory.GENERAL_MENTAL_HEALTH;
      
      const fallbackResult = {
        category: inferredCategory,
        confidence: hasPersonalPronouns ? 0.9 : 0.3,
        reasoning: hasPersonalPronouns
          ? (inferredCategory === QueryCategory.JOURNAL_SPECIFIC_NEEDS_CLARIFICATION
              ? 'BARE EMOTION DETECTED (fallback) - needs a clarifying question'
              : 'PERSONAL PRONOUNS DETECTED (fallback) - journal-specific')
          : 'Error in classification (fallback)',
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
