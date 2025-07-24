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
  currentDate?: Date; // Add currentDate prop
  onEntityClick?: (entity: string, sentiment: number) => void;
  className?: string;
}

const EntityStrips: React.FC<EntityStripsProps> = ({
  userId,
  timeRange,
  currentDate = new Date(), // Default to current date if not provided
  onEntityClick,
  className
}) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedEntity, setHighlightedEntity] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 300 }); // Default dimensions
  
  // Defensive theme access
  let theme = 'light';
  try {
    const themeData = useTheme();
    theme = themeData.theme;
  } catch (error) {
    console.warn('Theme provider not available, using default theme');
  }
  
  const isMobile = useIsMobile();
  
  // Calculate date range based on timeRange and currentDate
  const getDateRange = () => {
    // Use the provided currentDate instead of always using 'now'
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
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  };
  
  // Function to get sentiment color with appropriate intensity
  const getSentimentColor = (sentiment: number): string => {
    if (sentiment <= -1) return '#dc2626'; // Bright red for -1
    if (sentiment <= -0.2) return '#ef4444'; // Dull red for -0.2
    if (sentiment < 0) return '#fcd34d'; // Dull yellow for values between -0.19999 and 0
    if (sentiment < 0.2) return '#facc15'; // Bright yellow for values between 0 and 0.1999
    if (sentiment < 1) return '#65a30d'; // Dull green for values between 0.2 and 0.9999
    return '#22c55e'; // Bright green for 1.0
  };
  
  // Fetch themes and their sentiments
  useEffect(() => {
    const fetchEntities = async () => {
      if (!userId) {
        console.log('No user ID provided');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        console.log(`Fetching themes for timeRange: ${timeRange}, userId: ${userId}, currentDate: ${currentDate.toISOString()}`);
        const { startDate, endDate } = getDateRange();
        
        // Query journal entries within the time range
        const { data: entries, error } = await supabase
          .from('Journal Entries')
          .select('master_themes, sentiment')
          .eq('user_id', userId)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .not('master_themes', 'is', null);
        
        if (error) {
          console.error('Error fetching entries:', error);
          throw error;
        }
        
        console.log(`Found ${entries?.length || 0} entries with themes for date range ${startDate} to ${endDate}`);
        
        // Process entries to extract themes and calculate sentiments
        const themeMap = new Map<string, { count: number, totalSentiment: number }>();
        
        entries?.forEach(entry => {
          if (!entry.master_themes || !Array.isArray(entry.master_themes)) return;
          
          // Convert sentiment to number if it's a string
          let sentimentScore = 0;
          if (entry.sentiment) {
            if (typeof entry.sentiment === 'string') {
              if (entry.sentiment === 'positive') sentimentScore = 0.7;
              else if (entry.sentiment === 'negative') sentimentScore = -0.7;
              else if (entry.sentiment === 'neutral') sentimentScore = 0;
              else sentimentScore = parseFloat(entry.sentiment) || 0;
            } else {
              sentimentScore = Number(entry.sentiment) || 0;
            }
          }
          
          // Process each theme
          entry.master_themes.forEach(theme => {
            if (typeof theme === 'string' && theme.trim()) {
              const themeName = theme.toLowerCase().trim();
              
              if (!themeMap.has(themeName)) {
                themeMap.set(themeName, { count: 0, totalSentiment: 0 });
              }
              
              const themeData = themeMap.get(themeName)!;
              themeData.count += 1;
              themeData.totalSentiment += sentimentScore;
            }
          });
        });
        
        // Convert map to array and calculate average sentiment
        const entitiesArray = Array.from(themeMap.entries()).map(([name, data]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          count: data.count,
          sentiment: data.totalSentiment / data.count
        }));
        
        // Sort by frequency and take top 7
        const topEntities = entitiesArray
          .sort((a, b) => b.count - a.count)
          .slice(0, 7);
        
        console.log('Top themes for current period:', topEntities);
        setEntities(topEntities);
      } catch (error) {
        console.error('Error fetching theme data:', error);
        toast.error('Failed to load life areas');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEntities();
  }, [userId, timeRange, currentDate]); // Add currentDate to dependency array
  
  // Update dimensions when the component mounts and on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        
        // Ensure we have valid dimensions, with fallbacks
        const width = offsetWidth || 300;
        const height = offsetHeight || 300;
        
        setDimensions({
          width,
          height
        });
      }
    };
    
    // Initial update
    updateDimensions();
    
    // Add event listener
    window.addEventListener('resize', updateDimensions);
    
    // Update dimensions after a small delay to ensure the container is rendered
    const timeoutId = setTimeout(updateDimensions, 200);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timeoutId);
    };
  }, []);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (entities.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <p className="text-muted-foreground">
          <TranslatableText text="No life areas found in this time period" forceTranslate={true} />
        </p>
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
                    ({entity.sentiment.toFixed(2)})
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
    </div>
  );
};

export default EntityStrips;
