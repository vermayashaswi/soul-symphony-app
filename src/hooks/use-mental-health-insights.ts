
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { analyzeMentalHealthEntries } from '@/utils/chat/mentalHealthUtils';

export type MentalHealthInsights = {
  loading: boolean;
  hasEntries: boolean;
  entryCount?: number;
  averageSentiment?: number;
  dominantEmotions?: Array<{name: string, score: number, count: number}>;
  themes?: string[];
  timeRange?: string;
  error?: string;
};

export function useMentalHealthInsights(userId: string | undefined, timeRange?: { startDate?: string; endDate?: string; periodName?: string }) {
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
      
      const analysis = await analyzeMentalHealthEntries(userId, timeRange);
      
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
        timeRange: analysis.timeRange
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
