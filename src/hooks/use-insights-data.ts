
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TimeRange = 'today' | 'week' | 'month' | 'year';

interface InsightsData {
  entries: any[];
  allEntries: any[];
  dominantMood: any;
  aggregatedEmotionData: any;
}

export const useInsightsData = (userId: string | undefined, timeRange: TimeRange, globalDate: Date) => {
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsightsData = async () => {
      console.log('[useInsightsData] Starting fetch with params:', {
        userId,
        timeRange,
        globalDate: globalDate?.toISOString(),
        hasUserId: !!userId
      });

      if (!userId) {
        console.warn('[useInsightsData] No userId provided, skipping fetch');
        setInsightsData(null);
        setLoading(false);
        setError('No user ID available');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // First, let's check authentication status
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        console.log('[useInsightsData] Auth check:', {
          authUser: user?.id,
          providedUserId: userId,
          authError: authError?.message,
          userMatch: user?.id === userId
        });

        if (authError) {
          console.error('[useInsightsData] Auth error:', authError);
          setError(`Authentication error: ${authError.message}`);
          setLoading(false);
          return;
        }

        if (!user) {
          console.error('[useInsightsData] No authenticated user found');
          setError('No authenticated user found');
          setLoading(false);
          return;
        }

        if (user.id !== userId) {
          console.error('[useInsightsData] User ID mismatch:', {
            authUserId: user.id,
            providedUserId: userId
          });
          setError(`User ID mismatch: auth(${user.id}) vs provided(${userId})`);
          setLoading(false);
          return;
        }

        // Calculate date range for filtering
        const endDate = new Date(globalDate);
        let startDate = new Date(globalDate);

        switch (timeRange) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'week':
            startDate.setDate(startDate.getDate() - startDate.getDay());
            startDate.setHours(0, 0, 0, 0);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'month':
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'year':
            startDate = new Date(startDate.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate.getFullYear(), 11, 31);
            endDate.setHours(23, 59, 59, 999);
            break;
        }

        console.log('[useInsightsData] Date range:', {
          timeRange,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });

        // Fetch all entries for the user (without date filter first to check basic access)
        console.log('[useInsightsData] Fetching all entries for user...');
        const { data: allEntriesData, error: allEntriesError } = await supabase
          .from('Journal Entries')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        console.log('[useInsightsData] All entries query result:', {
          count: allEntriesData?.length || 0,
          error: allEntriesError?.message,
          sampleEntry: allEntriesData?.[0] ? {
            id: allEntriesData[0].id,
            user_id: allEntriesData[0].user_id,
            created_at: allEntriesData[0].created_at,
            hasContent: !!(allEntriesData[0]['refined text'] || allEntriesData[0]['transcription text'])
          } : null
        });

        if (allEntriesError) {
          console.error('[useInsightsData] Error fetching all entries:', allEntriesError);
          setError(`Database error: ${allEntriesError.message}`);
          setLoading(false);
          return;
        }

        // Fetch entries within date range
        console.log('[useInsightsData] Fetching filtered entries...');
        const { data: filteredEntriesData, error: filteredError } = await supabase
          .from('Journal Entries')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false });

        console.log('[useInsightsData] Filtered entries query result:', {
          count: filteredEntriesData?.length || 0,
          error: filteredError?.message,
          dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`
        });

        if (filteredError) {
          console.error('[useInsightsData] Error fetching filtered entries:', filteredError);
          setError(`Database error: ${filteredError.message}`);
          setLoading(false);
          return;
        }

        // Process emotions data for dominant mood
        let dominantMood = null;
        let aggregatedEmotionData = {};

        if (filteredEntriesData && filteredEntriesData.length > 0) {
          const emotionCounts: { [key: string]: number } = {};
          const emotionSums: { [key: string]: number } = {};

          filteredEntriesData.forEach(entry => {
            if (entry.emotions && typeof entry.emotions === 'object') {
              Object.entries(entry.emotions).forEach(([emotion, score]) => {
                const numScore = parseFloat(score as string) || 0;
                emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
                emotionSums[emotion] = (emotionSums[emotion] || 0) + numScore;
              });
            }
          });

          // Calculate averages and find dominant emotion
          const emotionAverages = Object.entries(emotionSums).map(([emotion, sum]) => ({
            emotion,
            average: sum / emotionCounts[emotion],
            count: emotionCounts[emotion]
          }));

          if (emotionAverages.length > 0) {
            const dominant = emotionAverages.reduce((prev, current) => 
              (current.average > prev.average) ? current : prev
            );
            
            dominantMood = {
              emotion: dominant.emotion,
              score: dominant.average,
              count: dominant.count
            };
          }

          // Prepare aggregated emotion data for charts
          aggregatedEmotionData = emotionAverages.reduce((acc, { emotion, average }) => {
            acc[emotion] = average;
            return acc;
          }, {} as { [key: string]: number });
        }

        const result = {
          entries: filteredEntriesData || [],
          allEntries: allEntriesData || [],
          dominantMood,
          aggregatedEmotionData
        };

        console.log('[useInsightsData] Final result:', {
          filteredEntries: result.entries.length,
          allEntries: result.allEntries.length,
          dominantMood: result.dominantMood,
          emotionDataKeys: Object.keys(result.aggregatedEmotionData)
        });

        setInsightsData(result);
        setError(null);

      } catch (err: any) {
        console.error('[useInsightsData] Unexpected error:', err);
        setError(`Unexpected error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchInsightsData();
  }, [userId, timeRange, globalDate]);

  return { insightsData, loading, error };
};
