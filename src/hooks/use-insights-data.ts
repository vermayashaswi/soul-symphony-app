
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type TimeRange = 'today' | 'week' | 'month' | 'year';

export type SentimentPoint = {
  date: string;
  value: number;
}

export type EmotionData = {
  emotion: string;
  score: number;
  sample_entries: {
    id: number;
    content: string;
    created_at: string;
    score: number;
  }[];
}

export type EmotionPoint = {
  date: string;
  value: number;
}

export type AggregatedEmotionData = {
  [emotion: string]: EmotionPoint[];
}

export function useInsightsData(userId?: string, timeRange: TimeRange = 'week') {
  const { user } = useAuth();
  const [sentimentData, setSentimentData] = useState<SentimentPoint[]>([]);
  const [emotionsData, setEmotionsData] = useState<EmotionData[]>([]);
  const [aggregatedEmotionData, setAggregatedEmotionData] = useState<AggregatedEmotionData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [journalActivity, setJournalActivity] = useState({ entryCount: 0, streak: 0 });
  const [dominantMood, setDominantMood] = useState<{ emotion: string; emoji: string } | null>(null);
  const [biggestImprovement, setBiggestImprovement] = useState<{ emotion: string; percentage: number } | null>(null);

  useEffect(() => {
    const effectiveUserId = userId || user?.id;
    if (!effectiveUserId) return;

    const fetchInsightsData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch sentiment data
        const { data: sentimentRawData, error: sentimentError } = await supabase
          .rpc('execute_dynamic_query', {
            query_text: `
              SELECT 
                DATE(created_at) as date, 
                AVG(CAST(sentiment AS float)) as value
              FROM 
                "Journal_Entries"
              WHERE 
                user_id = '${effectiveUserId}'
                AND sentiment IS NOT NULL
              GROUP BY 
                DATE(created_at)
              ORDER BY 
                date ASC
            `
          });
          
        if (sentimentError) throw sentimentError;
        
        // Format sentiment data for the chart
        const formattedSentiment: SentimentPoint[] = sentimentRawData ? sentimentRawData.map((point: any) => ({
          date: point.date,
          value: parseFloat(point.value)
        })) : [];
        
        setSentimentData(formattedSentiment);
        
        // Fetch emotions data
        const { data: emotionsRawData, error: emotionsError } = await supabase
          .rpc('get_top_emotions_with_entries', { 
            user_id_param: effectiveUserId,
            limit_count: 5
          });
          
        if (emotionsError) throw emotionsError;
        
        // Type assertion to ensure correct typing for emotionsData
        const typedEmotionsData: EmotionData[] = emotionsRawData ? emotionsRawData.map((item: any) => ({
          emotion: item.emotion,
          score: item.score,
          sample_entries: Array.isArray(item.sample_entries) ? item.sample_entries : []
        })) : [];
        
        setEmotionsData(typedEmotionsData);

        // Fetch entries for the selected time range
        const { data: entriesData, error: entriesError } = await supabase
          .from('Journal_Entries')
          .select('*')
          .eq('user_id', effectiveUserId)
          .order('created_at', { ascending: false });

        if (entriesError) throw entriesError;
        setEntries(entriesData || []);

        // Calculate aggregated emotion data for each emotion over time
        const tempAggregatedData: AggregatedEmotionData = {};
        
        if (entriesData) {
          entriesData.forEach((entry: any) => {
            if (entry.emotions && typeof entry.emotions === 'object') {
              Object.entries(entry.emotions).forEach(([emotion, score]: [string, any]) => {
                if (!tempAggregatedData[emotion]) {
                  tempAggregatedData[emotion] = [];
                }
                
                tempAggregatedData[emotion].push({
                  date: entry.created_at.substring(0, 10),
                  value: typeof score === 'number' ? score : 0
                });
              });
            }
          });
        }
        
        setAggregatedEmotionData(tempAggregatedData);
        
        // Set dummy data for other stats - these would be calculated based on actual data in a real implementation
        setJournalActivity({ 
          entryCount: entriesData?.length || 0, 
          streak: Math.floor(Math.random() * 5) + 1 
        });
        
        setDominantMood({
          emotion: typedEmotionsData.length > 0 ? typedEmotionsData[0].emotion : 'neutral',
          emoji: '😊'
        });
        
        setBiggestImprovement({
          emotion: typedEmotionsData.length > 1 ? typedEmotionsData[1].emotion : 'calm',
          percentage: Math.floor(Math.random() * 30) + 10
        });
        
      } catch (err: any) {
        console.error('Error fetching insights data:', err);
        setError(err.message || 'Failed to load insights data');
      } finally {
        setLoading(false);
      }
    };

    fetchInsightsData();
  }, [user?.id, userId, timeRange]);

  const fetchJournalEntryById = async (entryId: number) => {
    try {
      const { data, error } = await supabase
        .from('Journal_Entries')
        .select('*, emotions')
        .eq('id', entryId)
        .single();
        
      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error('Error fetching journal entry:', err);
      throw err;
    }
  };

  // Combined data object to return all insights data
  const insightsData = {
    sentimentData,
    emotionsData,
    entries,
    aggregatedEmotionData,
    journalActivity,
    dominantMood,
    biggestImprovement
  };

  return { 
    sentimentData, 
    emotionsData, 
    loading, 
    error,
    fetchJournalEntryById,
    insightsData
  };
}
