
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

export function useInsightsData() {
  const { user } = useAuth();
  const [sentimentData, setSentimentData] = useState<SentimentPoint[]>([]);
  const [emotionsData, setEmotionsData] = useState<EmotionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

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
                user_id = '${user.id}'
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
            user_id_param: user.id,
            limit_count: 5
          });
          
        if (emotionsError) throw emotionsError;
        
        setEmotionsData(emotionsRawData || []);
      } catch (err: any) {
        console.error('Error fetching insights data:', err);
        setError(err.message || 'Failed to load insights data');
      } finally {
        setLoading(false);
      }
    };

    fetchInsightsData();
  }, [user?.id]);

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

  return { 
    sentimentData, 
    emotionsData, 
    loading, 
    error,
    fetchJournalEntryById
  };
}
