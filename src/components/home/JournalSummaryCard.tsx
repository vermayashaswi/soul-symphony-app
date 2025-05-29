import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/use-theme';
import FloatingThemeStrips from './FloatingThemeStrips';
import { getClientTimeInfo } from '@/services/dateService';
import { useTutorial } from '@/contexts/TutorialContext';

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
  const { isActive, currentStep, steps } = useTutorial();
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themeData, setThemeData] = useState<ThemeData[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  // Check if we're in tutorial step 3 (theme strips step)
  const isInThemeStripsStep = isActive && steps[currentStep]?.id === 3;

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
        
        const clientInfo = getClientTimeInfo();
        
        console.log('JournalSummaryCard: Client timezone info', clientInfo);
        
        let summaryData;
        try {
          const { data, error: summaryError } = await supabase.functions.invoke('journal-summary', {
            body: { 
              userId: user.id, 
              days: 7,
              clientTimeInfo: clientInfo 
            }
          });
          
          if (summaryError) {
            console.error('Error fetching journal summary:', summaryError);
            setError('Failed to load your journal summary');
          } else {
            summaryData = data;
          }
        } catch (summaryFetchError) {
          console.error('Exception in journal summary fetch:', summaryFetchError);
          setError('Failed to connect to the journal summary service');
        }
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        try {
          const { data: journalEntries, error: entriesError } = await supabase
            .from('Journal Entries')
            .select('master_themes, sentiment')
            .eq('user_id', user.id)
            .gte('created_at', sevenDaysAgo.toISOString())
            .not('master_themes', 'is', null);
          
          console.log('JournalSummaryCard: Fetched journal entries', {
            entriesCount: journalEntries?.length || 0,
            error: entriesError?.message,
            dateFilter: sevenDaysAgo.toISOString()
          });
          
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
            
            if (themesWithSentiment.length > 0) {
              setThemeData(themesWithSentiment);
            } else {
              console.log('JournalSummaryCard: No valid theme data after processing');
              setThemeData(getFallbackThemeData());
            }
          } else {
            console.log('JournalSummaryCard: No journal entries with themes found');
            setThemeData(getFallbackThemeData());
          }
        } catch (entriesFetchError) {
          console.error('Error fetching or processing journal entries:', entriesFetchError);
          setThemeData(getFallbackThemeData());
        }
        
        if (summaryData) {
          setSummaryData(summaryData);
        }
      } catch (err) {
        console.error('Exception in journal summary fetch:', err);
        setError('Unexpected error loading your journal summary');
        setThemeData(getFallbackThemeData());
        
        if (retryCount < MAX_RETRIES) {
          console.log(`JournalSummaryCard: Retry attempt ${retryCount + 1} of ${MAX_RETRIES} in ${RETRY_DELAY}ms`);
          setRetryCount(count => count + 1);
          setTimeout(() => fetchSummary(), RETRY_DELAY); 
          return;
        }
      } finally {
        setLoading(false);
        setIsReady(true);
      }
    };
    
    fetchSummary();
  }, [user?.id, retryCount]);

  // Helper function to get fallback theme data
  const getFallbackThemeData = (): ThemeData[] => {
    return [
      { theme: 'Journal', sentiment: 0.5 },
      { theme: 'Writing', sentiment: 0.7 },
      { theme: 'Reflection', sentiment: 0.6 }
    ];
  };

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
    <div 
      className="h-full w-full"
      data-tutorial-target={isInThemeStripsStep ? "theme-strips" : undefined}
    >
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
