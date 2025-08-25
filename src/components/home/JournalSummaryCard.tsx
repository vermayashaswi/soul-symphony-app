import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/use-theme';
import FloatingThemeStrips from './FloatingThemeStrips';
import { getClientTimeInfo } from '@/services/dateService';

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
  // Defensive hook usage to prevent runtime errors during app initialization
  let colorTheme = 'Default';
  let customColor = '#3b82f6';
  
  try {
    const themeData = useTheme();
    colorTheme = themeData.colorTheme;
    customColor = themeData.customColor || '#3b82f6';
  } catch (error) {
    console.warn('JournalSummaryCard: ThemeProvider not ready, using defaults');
  }
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themeData, setThemeData] = useState<ThemeData[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

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
        
        // Get client timezone info from centralized service
        const clientInfo = getClientTimeInfo();
        
        console.log('JournalSummaryCard: Client timezone info', clientInfo);
        
        // Fetch journal summary with error handling
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
        
        // Calculate date 7 days ago for filtering - use our new service
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        try {
          // Fetch journal entries for theme data with proper date formatting (using themes column)
          const { data: journalEntries, error: entriesError } = await supabase
            .from('Journal Entries')
            .select('themes, sentiment')
            .eq('user_id', user.id)
            .gte('created_at', sevenDaysAgo.toISOString())
            .not('themes', 'is', null);
          
          console.log('JournalSummaryCard: Fetched journal entries', {
            entriesCount: journalEntries?.length || 0,
            error: entriesError?.message,
            dateFilter: sevenDaysAgo.toISOString()
          });
          
          if (entriesError) {
            console.error('Error fetching themes:', entriesError);
          } else if (journalEntries && journalEntries.length > 0) {
            // Process journal entries to extract theme data
            const themesWithSentiment: ThemeData[] = [];
            
            journalEntries.forEach(entry => {
              if (entry.themes && Array.isArray(entry.themes)) {
                const sentimentScore = entry.sentiment != null ? Number(entry.sentiment) : 0;
                
                entry.themes.forEach(theme => {
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
            
            // Ensure we have valid data before setting state
            if (themesWithSentiment.length > 0) {
              setThemeData(themesWithSentiment);
            } else {
              console.log('JournalSummaryCard: No valid theme data after processing');
              // Set some fallback data to ensure smooth UI experience
              setThemeData(getFallbackThemeData());
            }
          } else {
            console.log('JournalSummaryCard: No journal entries with themes found');
            // Set fallback data
            setThemeData(getFallbackThemeData());
          }
        } catch (entriesFetchError) {
          console.error('Error fetching or processing journal entries:', entriesFetchError);
          // Set fallback data
          setThemeData(getFallbackThemeData());
        }
        
        if (summaryData) {
          setSummaryData(summaryData);
        }
      } catch (err) {
        console.error('Exception in journal summary fetch:', err);
        setError('Unexpected error loading your journal summary');
        // Use fallback data for theme display
        setThemeData(getFallbackThemeData());
        
        // If we've tried less than MAX_RETRIES times, try again after a delay
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
