
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/use-theme';
import FloatingThemeStrips from './FloatingThemeStrips';

interface SummaryResponse {
  summary: string | null;
  topEntities: Array<{ name: string; count: number; type?: string }>;
  hasEntries: boolean;
  entryCount?: number;
  masterThemes?: string[];
  error?: string;
}

interface ThemeData {
  theme: string;
  sentiment: number;
}

const JournalSummaryCard: React.FC = () => {
  const { user } = useAuth();
  const { colorTheme, customColor } = useTheme();
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themeData, setThemeData] = useState<ThemeData[]>([]);
  const [isReady, setIsReady] = useState(false);

  const getThemeColorHex = (): string => {
    switch (colorTheme) {
      case 'Default':
        return '#3b82f6';
      case 'Calm':
        return '#8b5cf6';
      case 'Soothing':
        return '#FFDEE2';
      case 'Energy':
        return '#f59e0b';
      case 'Focus':
        return '#10b981';
      case 'Custom':
        return customColor;
      default:
        return '#3b82f6';
    }
  };

  useEffect(() => {
    const fetchSummary = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const { data: summaryData, error: summaryError } = await supabase.functions.invoke('journal-summary', {
          body: { userId: user.id, days: 7 }
        });
        
        if (summaryError) {
          console.error('Error fetching journal summary:', summaryError);
          setError('Failed to load your journal summary');
          return;
        }
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { data: journalEntries, error: entriesError } = await supabase
          .from('Journal Entries')
          .select('master_themes, sentiment')
          .eq('user_id', user.id)
          .gte('created_at', sevenDaysAgo.toISOString())
          .not('master_themes', 'is', null);
        
        if (entriesError) {
          console.error('Error fetching master themes:', entriesError);
        } else if (journalEntries && journalEntries.length > 0) {
          const themesWithSentiment: ThemeData[] = [];
          
          journalEntries.forEach(entry => {
            if (entry.master_themes && Array.isArray(entry.master_themes)) {
              const sentimentScore = entry.sentiment ? parseFloat(entry.sentiment) : 0;
              
              entry.master_themes.forEach(theme => {
                if (theme && typeof theme === 'string') {
                  themesWithSentiment.push({
                    theme,
                    sentiment: sentimentScore
                  });
                }
              });
            }
          });
          
          console.log('JournalSummaryCard: Processed theme data', { 
            count: themesWithSentiment.length,
            samples: themesWithSentiment.slice(0, 3).map(t => t.theme)
          });
          
          setThemeData(themesWithSentiment);
        } else {
          console.log('JournalSummaryCard: No journal entries with themes found');
          setThemeData([]);
        }
        
        setSummaryData(summaryData);
      } catch (err) {
        console.error('Exception in journal summary fetch:', err);
        setError('Unexpected error loading your journal summary');
      } finally {
        setLoading(false);
        setIsReady(true);
      }
    };
    
    fetchSummary();
  }, [user?.id]);

  // Don't render anything until we're ready
  if (!isReady) {
    return null;
  }

  // If there's an error, log it but still render the component (it might recover with theme data)
  if (error) {
    console.error('JournalSummaryCard error:', error);
  }

  // Provide a default empty array if themeData is falsy to avoid rendering issues
  const safeThemeData = themeData || [];
  const themeColor = getThemeColorHex();

  return (
    <div className="h-full w-full">
      {isReady && !loading && (
        <FloatingThemeStrips 
          themesData={safeThemeData} 
          themeColor={themeColor}
        />
      )}
    </div>
  );
};

export default JournalSummaryCard;
