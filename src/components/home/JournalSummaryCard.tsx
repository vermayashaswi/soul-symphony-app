import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ThemeBubbleAnimation from './ThemeBubbleAnimation';
import { useTheme } from '@/hooks/use-theme';

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
        } else {
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
          
          setThemeData(themesWithSentiment);
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

  if (!isReady) {
    return null;
  }

  if (error) {
    console.error('JournalSummaryCard error:', error);
    return <div className="h-full w-full"></div>;
  }

  const themeColor = getThemeColorHex();
  
  const createBubbleBackground = () => {
    return `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 1) 5%, ${themeColor} 20%, ${themeColor} 60%, ${themeColor} 100%)`;
  };

  return (
    <div className="h-full w-full">
      {isReady && !loading && (
        <>
          <div className="absolute top-12 left-4 flex items-center gap-2 z-50 pointer-events-none">
            <p 
              className="text-xs text-muted-foreground text-glow"
              style={{ 
                fontWeight: 500,
                letterSpacing: '0.01em',
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale'
              }}
            >
              Your last 7 days
            </p>
            <div 
              className="w-5 h-5 rounded-full flex items-center justify-center pointer-events-auto"
              style={{ 
                background: createBubbleBackground(),
                boxShadow: `0 0 6px 3px rgba(255, 255, 255, 1), inset 0 0 10px rgba(255, 255, 255, 1), 0 0 6px ${themeColor}`,
                backdropFilter: 'blur(2px)',
                border: '1px solid rgba(255, 255, 255, 1)',
              }}
              title="Journal themes from recent entries"
            >
              <span 
                className="text-center text-[6px] font-medium" 
                style={{ 
                  color: 'rgba(0, 0, 0, 1)',
                  fontWeight: 600,
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale'
                }}
              >
                theme
              </span>
            </div>
          </div>
          <ThemeBubbleAnimation 
            themesData={themeData} 
            maxBubbles={5}
          />
        </>
      )}
    </div>
  );
};

export default JournalSummaryCard;
