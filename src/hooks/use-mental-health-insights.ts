
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { analyzeMentalHealthEntries } from '@/utils/chat/mentalHealthUtils';
import { analyzeTimePatterns, analyzeTimeEmotionPatterns } from '@/utils/chat/timePatternAnalyzer';

export type MentalHealthInsights = {
  loading: boolean;
  hasEntries: boolean;
  entryCount?: number;
  averageSentiment?: number;
  dominantEmotions?: Array<{name: string, score: number, count: number}>;
  themes?: string[];
  timeRange?: string;
  timePatterns?: any;
  timeEmotionPatterns?: any;
  error?: string;
};

export function useMentalHealthInsights(userId: string | undefined, timeRange?: { startDate?: string; endDate?: string; periodName?: string; duration?: number }) {
  const [insights, setInsights] = useState<MentalHealthInsights>({
    loading: true,
    hasEntries: false
  });

  const fetchInsights = useCallback(async () => {
    if (!userId) {
      setInsights({
        loading: false,
        hasEntries: false,
        error: "No user ID provided"
      });
      return;
    }

    try {
      setInsights(currentInsights => ({ ...currentInsights, loading: true }));
      
      // Get basic mental health analysis
      const analysis = await analyzeMentalHealthEntries(userId, timeRange);
      
      // Get time pattern analysis
      const timePatterns = await analyzeTimePatterns(userId, timeRange);
      
      // Get time-emotion correlation analysis
      const timeEmotionPatterns = await analyzeTimeEmotionPatterns(userId, timeRange);
      
      if (!analysis) {
        setInsights({
          loading: false,
          hasEntries: false,
          error: "Error analyzing mental health data"
        });
        return;
      }
      
      setInsights({
        loading: false,
        hasEntries: analysis.hasEntries,
        entryCount: analysis.entryCount,
        averageSentiment: analysis.averageSentiment,
        dominantEmotions: analysis.dominantEmotions,
        themes: analysis.themes,
        timeRange: analysis.timeRange,
        timePatterns: timePatterns || null,
        timeEmotionPatterns: timeEmotionPatterns || null
      });
    } catch (error) {
      console.error("Error fetching mental health insights:", error);
      setInsights({
        loading: false,
        hasEntries: false,
        error: "Error fetching mental health insights"
      });
    }
  }, [userId, timeRange]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return {
    insights,
    refreshInsights: fetchInsights
  };
}
