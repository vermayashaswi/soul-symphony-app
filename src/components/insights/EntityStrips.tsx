
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { TimeRange } from '@/hooks/use-insights-data';
import { toast } from 'sonner';
import { TranslatableText } from '@/components/translation/TranslatableText';
import {
  addDays, addWeeks, addMonths, addYears,
  subDays, subWeeks, subMonths, subYears,
  startOfDay, startOfWeek, startOfMonth, startOfYear
} from 'date-fns';

type Entity = {
  name: string;
  count: number;
  sentiment: number;
};

interface EntityStripsProps {
  userId?: string;
  timeRange: TimeRange;
  currentDate?: Date;
  onEntityClick?: (entity: string, sentiment: number) => void;
  className?: string;
}

const EntityStrips: React.FC<EntityStripsProps> = ({
  userId,
  timeRange,
  currentDate = new Date(),
  onEntityClick,
  className
}) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [highlightedEntity, setHighlightedEntity] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 300 });
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  
  // Enhanced date range calculation with debugging
  const getDateRange = () => {
    const baseDate = currentDate;
    let startDate: Date;
    let endDate: Date;
    
    switch (timeRange) {
      case 'today':
        startDate = startOfDay(baseDate);
        endDate = addDays(startDate, 1);
        break;
      case 'week':
        startDate = startOfWeek(baseDate, { weekStartsOn: 1 });
        endDate = addWeeks(startDate, 1);
        break;
      case 'month':
        startDate = startOfMonth(baseDate);
        endDate = addMonths(startDate, 1);
        break;
      case 'year':
        startDate = startOfYear(baseDate);
        endDate = addYears(startDate, 1);
        break;
      default:
        startDate = startOfDay(baseDate);
        endDate = addDays(startDate, 1);
    }
    
    const dateRange = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
    
    console.log('[EntityStrips] Date range calculation:', {
      timeRange,
      baseDate: baseDate.toISOString(),
      calculatedRange: dateRange
    });
    
    return dateRange;
  };
  
  // Enhanced sentiment color function
  const getSentimentColor = (sentiment: number): string => {
    if (sentiment <= -1) return '#dc2626'; // Bright red for -1
    if (sentiment <= -0.2) return '#ef4444'; // Dull red for -0.2
    if (sentiment < 0) return '#fcd34d'; // Dull yellow for values between -0.19999 and 0
    if (sentiment < 0.2) return '#facc15'; // Bright yellow for values between 0 and 0.1999
    if (sentiment < 1) return '#65a30d'; // Dull green for values between 0.2 and 0.9999
    return '#22c55e'; // Bright green for 1.0
  };
  
  // Enhanced data fetching with comprehensive debugging
  useEffect(() => {
    const fetchEntities = async () => {
      console.log('[EntityStrips] Starting fetch with params:', {
        userId,
        timeRange,
        currentDate: currentDate.toISOString(),
        hasUserId: !!userId
      });

      if (!userId) {
        console.warn('[EntityStrips] No userId provided, clearing data');
        setEntities([]);
        setLoading(false);
        setError('No user ID provided');
        setDebugInfo({ error: 'No userId provided' });
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Step 1: Verify authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        console.log('[EntityStrips] Auth verification:', {
          authUser: user?.id,
          providedUserId: userId,
          authError: authError?.message,
          userMatch: user?.id === userId
        });

        if (authError) {
          throw new Error(`Authentication error: ${authError.message}`);
        }

        if (!user) {
          throw new Error('No authenticated user found');
        }

        if (user.id !== userId) {
          throw new Error(`User ID mismatch: auth(${user.id}) vs provided(${userId})`);
        }

        const { startDate, endDate } = getDateRange();
        
        // Step 2: First check total entries for this user (no date filter)
        console.log('[EntityStrips] Checking total user entries...');
        const { data: totalEntries, error: totalError } = await supabase
          .from('Journal Entries')
          .select('id, created_at, master_themes')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (totalError) {
          console.error('[EntityStrips] Error fetching total entries:', totalError);
          throw new Error(`Database error: ${totalError.message}`);
        }

        console.log('[EntityStrips] Total entries for user:', {
          totalCount: totalEntries?.length || 0,
          entriesWithThemes: totalEntries?.filter(e => e.master_themes && e.master_themes.length > 0).length || 0,
          sampleEntry: totalEntries?.[0] ? {
            id: totalEntries[0].id,
            created_at: totalEntries[0].created_at,
            hasThemes: !!(totalEntries[0].master_themes && totalEntries[0].master_themes.length > 0)
          } : null
        });

        // Step 3: Query entries within the specific date range
        console.log('[EntityStrips] Fetching entries for date range:', { startDate, endDate });
        const { data: entries, error: entriesError } = await supabase
          .from('Journal Entries')
          .select('id, master_themes, sentiment, created_at')
          .eq('user_id', userId)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .not('master_themes', 'is', null)
          .order('created_at', { ascending: false });
        
        if (entriesError) {
          console.error('[EntityStrips] Error fetching filtered entries:', entriesError);
          throw new Error(`Database error: ${entriesError.message}`);
        }
        
        console.log('[EntityStrips] Filtered entries result:', {
          filteredCount: entries?.length || 0,
          dateRange: `${startDate} to ${endDate}`,
          entriesWithValidThemes: entries?.filter(e => 
            e.master_themes && 
            Array.isArray(e.master_themes) && 
            e.master_themes.length > 0
          ).length || 0
        });

        // Step 4: Process themes and calculate sentiments
        const themeMap = new Map<string, { count: number, totalSentiment: number, entries: any[] }>();
        
        entries?.forEach(entry => {
          if (!entry.master_themes || !Array.isArray(entry.master_themes)) {
            console.warn('[EntityStrips] Entry has invalid master_themes:', {
              entryId: entry.id,
              master_themes: entry.master_themes
            });
            return;
          }
          
          // Enhanced sentiment processing with better fallbacks
          let sentimentScore = 0;
          if (entry.sentiment) {
            if (typeof entry.sentiment === 'string') {
              switch (entry.sentiment.toLowerCase()) {
                case 'positive':
                  sentimentScore = 0.7;
                  break;
                case 'negative':
                  sentimentScore = -0.7;
                  break;
                case 'neutral':
                  sentimentScore = 0;
                  break;
                default:
                  // Try to parse as number
                  const parsed = parseFloat(entry.sentiment);
                  sentimentScore = isNaN(parsed) ? 0 : Math.max(-1, Math.min(1, parsed));
              }
            } else {
              sentimentScore = Math.max(-1, Math.min(1, Number(entry.sentiment) || 0));
            }
          }
          
          // Process each theme
          entry.master_themes.forEach(theme => {
            if (typeof theme === 'string' && theme.trim()) {
              const themeName = theme.toLowerCase().trim();
              
              if (!themeMap.has(themeName)) {
                themeMap.set(themeName, { count: 0, totalSentiment: 0, entries: [] });
              }
              
              const themeData = themeMap.get(themeName)!;
              themeData.count += 1;
              themeData.totalSentiment += sentimentScore;
              themeData.entries.push({
                id: entry.id,
                sentiment: sentimentScore,
                created_at: entry.created_at
              });
            }
          });
        });
        
        // Step 5: Convert to final format and sort
        const entitiesArray = Array.from(themeMap.entries()).map(([name, data]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          count: data.count,
          sentiment: data.totalSentiment / data.count
        }));
        
        const topEntities = entitiesArray
          .sort((a, b) => b.count - a.count)
          .slice(0, 7);
        
        console.log('[EntityStrips] Final processing result:', {
          totalThemes: entitiesArray.length,
          topEntities: topEntities.map(e => ({
            name: e.name,
            count: e.count,
            sentiment: e.sentiment.toFixed(2)
          }))
        });

        // Set debug info for the debug panel
        setDebugInfo({
          totalUserEntries: totalEntries?.length || 0,
          filteredEntries: entries?.length || 0,
          processedThemes: entitiesArray.length,
          displayedThemes: topEntities.length,
          dateRange: { startDate, endDate },
          sampleProcessing: themeMap.size > 0 ? {
            firstTheme: Array.from(themeMap.entries())[0]
          } : null
        });
        
        setEntities(topEntities);
        setError(null);
        
      } catch (err: any) {
        console.error('[EntityStrips] Fetch error:', err);
        setError(err.message);
        setDebugInfo({ error: err.message, stack: err.stack });
        toast.error(`Failed to load life areas: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEntities();
  }, [userId, timeRange, currentDate]);
  
  // Update dimensions when the component mounts and on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        const width = offsetWidth || 300;
        const height = offsetHeight || 300;
        setDimensions({ width, height });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    const timeoutId = setTimeout(updateDimensions, 200);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timeoutId);
    };
  }, []);
  
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Error state with enhanced debugging
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-4">
        <div className="text-red-500 text-center mb-4">
          <p className="font-medium">Failed to load life areas</p>
          <p className="text-sm">{error}</p>
        </div>
        {debugInfo && (
          <details className="w-full max-w-md">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              Debug Info
            </summary>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded mt-2 overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  }
  
  // Empty state with debug info
  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-4">
        <p className="text-muted-foreground text-center mb-4">
          <TranslatableText text="No life areas found in this time period" forceTranslate={true} />
        </p>
        {debugInfo && (
          <details className="w-full max-w-md">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              Debug Info
            </summary>
            <div className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded mt-2">
              <p><strong>Total user entries:</strong> {debugInfo.totalUserEntries}</p>
              <p><strong>Filtered entries:</strong> {debugInfo.filteredEntries}</p>
              <p><strong>Date range:</strong> {debugInfo.dateRange?.startDate} to {debugInfo.dateRange?.endDate}</p>
              <p><strong>Processed themes:</strong> {debugInfo.processedThemes}</p>
            </div>
          </details>
        )}
      </div>
    );
  }

  // Helper to ensure sentiment is within range -1 to 1
  const normalizeScore = (score: number) => {
    return Math.max(-1, Math.min(1, score));
  };

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full h-full overflow-hidden flex flex-col", className)}
      style={{ minHeight: isMobile ? '250px' : '300px' }}
    >
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {entities.map((entity) => {
          const isHighlighted = highlightedEntity === entity.name;
          const normalizedSentiment = normalizeScore(entity.sentiment);
          const sentimentColor = getSentimentColor(normalizedSentiment);
          
          // Calculate width based on count relative to max count
          const maxCount = Math.max(...entities.map(e => e.count));
          const width = 40 + ((entity.count / maxCount) * 60); // Width between 40% and 100%
          
          return (
            <motion.div
              key={entity.name}
              className={cn(
                "rounded-md cursor-pointer transition-all flex items-center justify-center",
                "text-white shadow-md",
                isHighlighted ? "z-10" : "z-0"
              )}
              style={{
                backgroundColor: sentimentColor,
                width: `${width}%`,
                height: "40px",
                opacity: isHighlighted ? 0.95 : 0.8,
                margin: "0 auto"
              }}
              initial={{ scaleX: 0 }}
              animate={{ 
                scaleX: 1,
                boxShadow: isHighlighted ? '0 0 10px rgba(0,0,0,0.2)' : '0 0 5px rgba(0,0,0,0.1)'
              }}
              transition={{ 
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: 0.05 
              }}
              onMouseEnter={() => setHighlightedEntity(entity.name)}
              onMouseLeave={() => setHighlightedEntity(null)}
              onClick={() => onEntityClick?.(entity.name, entity.sentiment)}
            >
              <div className="text-center px-2 truncate max-w-full">
                <span className="font-medium">
                  <TranslatableText text={entity.name} forceTranslate={true} />
                </span>
                {isHighlighted && (
                  <span className="ml-2 text-white/90 text-xs">
                    ({entity.sentiment.toFixed(2)}, {entity.count}x)
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {/* Color legend */}
      <div className="mt-8 mb-2">
        <div className="h-6 relative rounded-md overflow-hidden flex">
          <div className="w-1/6 bg-[#dc2626]"></div>
          <div className="w-1/6 bg-[#ef4444]"></div>
          <div className="w-1/6 bg-[#fcd34d]"></div>
          <div className="w-1/6 bg-[#facc15]"></div>
          <div className="w-1/6 bg-[#65a30d]"></div>
          <div className="w-1/6 bg-[#22c55e]"></div>
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>
            <TranslatableText text="Negative (-1.0)" forceTranslate={true} />
          </span>
          <span>
            <TranslatableText text="Neutral (0.0)" forceTranslate={true} />
          </span>
          <span>
            <TranslatableText text="Positive (1.0)" forceTranslate={true} />
          </span>
        </div>
      </div>

      {/* Debug info footer - only show in development */}
      {process.env.NODE_ENV === 'development' && debugInfo && (
        <details className="mt-2">
          <summary className="text-xs text-gray-400 cursor-pointer">Debug</summary>
          <div className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded mt-1">
            <p>Entries: {debugInfo.filteredEntries}/{debugInfo.totalUserEntries}</p>
            <p>Themes: {debugInfo.displayedThemes}/{debugInfo.processedThemes}</p>
          </div>
        </details>
      )}
    </div>
  );
};

export default EntityStrips;
