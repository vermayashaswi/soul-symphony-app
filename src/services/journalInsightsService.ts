
import { supabase } from "@/integrations/supabase/client";

/**
 * Service for accessing journal insights functions
 */
export const journalInsightsService = {
  /**
   * Detect emotional volatility in journal entries
   * @param userId User ID
   * @param timeframe Time range to analyze (default: '30days')
   */
  async detectEmotionalVolatility(userId: string, timeframe: '7days' | '30days' | '90days' = '30days') {
    try {
      const { data, error } = await supabase.functions.invoke('journal-insights-functions', {
        body: {
          userId,
          functionName: 'detect_emotional_volatility',
          params: { timeframe }
        }
      });

      if (error) {
        console.error('Error detecting emotional volatility:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in detectEmotionalVolatility:', error);
      throw error;
    }
  },

  /**
   * Summarize life areas by theme in journal entries
   * @param userId User ID
   * @param timeframe Time range to analyze (default: '30days')
   */
  async summarizeLifeAreasByTheme(userId: string, timeframe: '7days' | '30days' | '90days' = '30days') {
    try {
      const { data, error } = await supabase.functions.invoke('journal-insights-functions', {
        body: {
          userId,
          functionName: 'summarize_life_areas_by_theme',
          params: { timeframe }
        }
      });

      if (error) {
        console.error('Error summarizing life areas:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in summarizeLifeAreasByTheme:', error);
      throw error;
    }
  },

  /**
   * Get reflection prompt suggestions based on journal content
   * @param userId User ID
   * @param timeframe Time range to analyze (default: '30days')
   * @param count Number of prompts to generate (default: 5)
   */
  async suggestReflectionPrompts(userId: string, timeframe: '7days' | '30days' | '90days' = '30days', count: number = 5) {
    try {
      const { data, error } = await supabase.functions.invoke('journal-insights-functions', {
        body: {
          userId,
          functionName: 'suggest_reflection_prompts',
          params: { timeframe, count }
        }
      });

      if (error) {
        console.error('Error suggesting reflection prompts:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in suggestReflectionPrompts:', error);
      throw error;
    }
  },

  /**
   * Compare journal entries from different time periods
   * @param userId User ID
   * @param currentPeriod The current time period to analyze ('7days', '30days', '90days')
   * @param comparisonPeriod Type of comparison ('previous' or 'year_ago')
   */
  async compareWithPastPeriods(
    userId: string, 
    currentPeriod: '7days' | '30days' | '90days' = '30days',
    comparisonPeriod: 'previous' | 'year_ago' = 'previous'
  ) {
    try {
      const { data, error } = await supabase.functions.invoke('journal-insights-functions', {
        body: {
          userId,
          functionName: 'compare_with_past_periods',
          params: { currentPeriod, comparisonPeriod }
        }
      });

      if (error) {
        console.error('Error comparing periods:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in compareWithPastPeriods:', error);
      throw error;
    }
  },

  /**
   * Recommend microhabits based on emotion patterns
   * @param userId User ID
   * @param timeframe Time range to analyze (default: '30days')
   * @param count Number of habits to suggest (default: 5)
   */
  async recommendMicrohabits(userId: string, timeframe: '7days' | '30days' | '90days' = '30days', count: number = 5) {
    try {
      const { data, error } = await supabase.functions.invoke('journal-insights-functions', {
        body: {
          userId,
          functionName: 'recommend_microhabits',
          params: { timeframe, count }
        }
      });

      if (error) {
        console.error('Error recommending microhabits:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in recommendMicrohabits:', error);
      throw error;
    }
  },

  /**
   * Detect periods of silence between journal entries
   * @param userId User ID
   * @param timeframe Time range to analyze (default: '90days')
   * @param gapThresholdDays Minimum days to consider a gap (default: 3)
   */
  async detectSilencePeriods(
    userId: string, 
    timeframe: '30days' | '90days' | '180days' | '365days' = '90days',
    gapThresholdDays: number = 3
  ) {
    try {
      const { data, error } = await supabase.functions.invoke('journal-insights-functions', {
        body: {
          userId,
          functionName: 'detect_silence_periods',
          params: { timeframe, gapThresholdDays }
        }
      });

      if (error) {
        console.error('Error detecting silence periods:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in detectSilencePeriods:', error);
      throw error;
    }
  },

  /**
   * Recommend journal entries that are worth sharing or saving
   * @param userId User ID
   * @param timeframe Time range to analyze (default: '90days')
   * @param count Number of entries to recommend (default: 3)
   */
  async recommendSharedEntries(
    userId: string, 
    timeframe: '30days' | '90days' | '180days' | '365days' = '90days',
    count: number = 3
  ) {
    try {
      const { data, error } = await supabase.functions.invoke('journal-insights-functions', {
        body: {
          userId,
          functionName: 'recommend_shared_entries',
          params: { timeframe, count }
        }
      });

      if (error) {
        console.error('Error recommending shared entries:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in recommendSharedEntries:', error);
      throw error;
    }
  }
};
