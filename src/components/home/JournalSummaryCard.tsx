
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import ThemeBubbleAnimation from './ThemeBubbleAnimation';

interface SummaryResponse {
  summary: string | null;
  topEntities: Array<{ name: string; count: number; type?: string }>;
  hasEntries: boolean;
  entryCount?: number;
  masterThemes?: string[];
  error?: string;
}

const JournalSummaryCard: React.FC = () => {
  const { user } = useAuth();
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [masterThemes, setMasterThemes] = useState<string[]>([]);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Fetch summary data from Supabase function
        const { data: summaryData, error: summaryError } = await supabase.functions.invoke('journal-summary', {
          body: { userId: user.id, days: 7 }
        });
        
        if (summaryError) {
          console.error('Error fetching journal summary:', summaryError);
          setError('Failed to load your journal summary');
          return;
        }
        
        // Fetch master themes from Journal Entries
        const { data: journalEntries, error: entriesError } = await supabase
          .from('Journal Entries')
          .select('master_themes')
          .eq('user_id', user.id)
          .not('master_themes', 'is', null)
          .limit(15);
        
        if (entriesError) {
          console.error('Error fetching master themes:', entriesError);
        } else {
          // Extract and flatten all master themes
          const allThemes = journalEntries
            .map(entry => entry.master_themes || [])
            .flat()
            .filter((theme): theme is string => Boolean(theme));
          
          // Remove duplicates
          const uniqueThemes = [...new Set(allThemes)];
          setMasterThemes(uniqueThemes);
        }
        
        setSummaryData(summaryData);
      } catch (err) {
        console.error('Exception in journal summary fetch:', err);
        setError('Unexpected error loading your journal summary');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSummary();
  }, [user?.id]);

  return (
    <Card className="w-full bg-transparent shadow-none border-none h-[146px]">
      <CardHeader className="pb-0">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center gap-2 bg-card text-foreground px-3 py-1 rounded-full">
            <Calendar className="h-5 w-5 text-primary" />
            Your last 7 days
          </CardTitle>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="p-0 h-full">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
          </div>
        ) : error ? (
          <div className="text-destructive text-sm p-2">{error}</div>
        ) : (
          <div className="h-full w-full">
            <ThemeBubbleAnimation 
              themes={masterThemes} 
              maxBubbles={5}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JournalSummaryCard;
