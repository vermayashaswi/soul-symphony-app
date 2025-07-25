import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/use-theme';
import FloatingThemeStrips from './FloatingThemeStrips';
import { useNonBlockingJournalSummary } from '@/hooks/useNonBlockingJournalSummary';

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
  // Use non-blocking summary hook
  const { data: summaryData, loading: summaryLoading, fromCache } = useNonBlockingJournalSummary(7);
  
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
  
  const [themeData, setThemeData] = useState<ThemeData[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [themeLoading, setThemeLoading] = useState(false);

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

  // Optimized theme data fetching
  useEffect(() => {
    const fetchThemeData = async () => {
      if (!user?.id || themeLoading) return;
      
      try {
        setThemeLoading(true);
        
        // Fast timeout for theme data (non-critical)
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Theme fetch timeout')), 2000)
        );
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const fetchPromise = supabase
          .from('Journal Entries')
          .select('master_themes, sentiment')
          .eq('user_id', user.id)
          .gte('created_at', sevenDaysAgo.toISOString())
          .not('master_themes', 'is', null)
          .limit(20); // Limit for performance
        
        try {
          const { data: journalEntries, error: entriesError } = await Promise.race([
            fetchPromise,
            timeoutPromise
          ]);
          
          if (entriesError) {
            console.warn('Theme data fetch failed:', entriesError);
            setThemeData(getFallbackThemeData());
            return;
          }
          
          if (journalEntries && journalEntries.length > 0) {
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
            
            setThemeData(themesWithSentiment.length > 0 ? themesWithSentiment : getFallbackThemeData());
          } else {
            setThemeData(getFallbackThemeData());
          }
        } catch (timeoutError) {
          console.warn('Theme data timeout, using fallback');
          setThemeData(getFallbackThemeData());
        }
      } catch (error) {
        console.warn('Theme data error:', error);
        setThemeData(getFallbackThemeData());
      } finally {
        setThemeLoading(false);
        setIsReady(true);
      }
    };

    // Defer theme data loading to not block initial render
    setTimeout(() => {
      fetchThemeData();
    }, 100);
  }, [user?.id]);

  // Helper function to get fallback theme data
  const getFallbackThemeData = (): ThemeData[] => {
    return [
      { theme: 'Journal', sentiment: 0.5 },
      { theme: 'Writing', sentiment: 0.7 },
      { theme: 'Reflection', sentiment: 0.6 }
    ];
  };

  // Show immediately with fallback data to prevent blocking
  useEffect(() => {
    if (!isReady && !themeLoading) {
      // Set fallback data immediately to show something
      setThemeData(getFallbackThemeData());
      setIsReady(true);
    }
  }, [themeLoading]);

  // Always render something to prevent layout shift

  // Provide a default empty array if themeData is falsy to avoid rendering issues
  const safeThemeData = themeData || [];
  const themeColor = getThemeColorHex();

  return (
    <div className="h-full w-full">
      <FloatingThemeStrips 
        themesData={safeThemeData} 
        themeColor={themeColor}
      />
    </div>
  );
};

export default JournalSummaryCard;
