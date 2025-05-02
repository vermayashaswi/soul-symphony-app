import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { TimeRange } from '@/hooks/use-insights-data';
import { toast } from 'sonner';
import { Json } from '@/types/journal';
import { TranslatableText } from '@/components/translation/TranslatableText';

type Entity = {
  name: string;
  count: number;
  sentiment: number;
};

interface EntityStripsProps {
  userId?: string;
  timeRange: TimeRange;
  onEntityClick?: (entity: string, sentiment: number) => void;
  className?: string;
}

const EntityStrips: React.FC<EntityStripsProps> = ({
  userId,
  timeRange,
  onEntityClick,
  className
}) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedEntity, setHighlightedEntity] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 300 }); // Default dimensions
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  
  // Calculate date range based on timeRange
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
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
  
  // Type guard to check if entity is a string or has name property
  const isValidEntity = (entity: Json): entity is string | { name: string; type?: string } => {
    if (typeof entity === 'string') {
      return true;
    }
    if (typeof entity === 'object' && entity !== null && 'name' in entity && typeof entity.name === 'string') {
      return true;
    }
    return false;
  };
  
  // Fetch entities and their sentiments
  useEffect(() => {
    const fetchEntities = async () => {
      if (!userId) {
        console.log('No user ID provided');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        console.log(`Fetching entities for timeRange: ${timeRange}, userId: ${userId}`);
        const { startDate, endDate } = getDateRange();
        
        // Query journal entries within the time range
        const { data: entries, error } = await supabase
          .from('Journal Entries')
          .select('entities, sentiment')
          .eq('user_id', userId)
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        
        if (error) {
          console.error('Error fetching entries:', error);
          throw error;
        }
        
        console.log(`Found ${entries?.length || 0} entries`);
        
        // Process entries to extract entities and calculate sentiments
        const entityMap = new Map<string, { count: number, totalSentiment: number }>();
        
        entries?.forEach(entry => {
          if (!entry.entities || !entry.sentiment) return;
          
          // Convert sentiment to number if it's a string
          const sentimentScore = typeof entry.sentiment === 'string' 
            ? parseFloat(entry.sentiment) 
            : Number(entry.sentiment);
            
          if (isNaN(sentimentScore)) return;
          
          let entitiesArray: Array<Json> = [];
          
          // Handle different formats of entities data
          if (typeof entry.entities === 'string') {
            try {
              const parsed = JSON.parse(entry.entities);
              if (Array.isArray(parsed)) {
                entitiesArray = parsed;
              }
            } catch (e) {
              console.error('Failed to parse entities JSON:', e);
            }
          } 
          else if (Array.isArray(entry.entities)) {
            entitiesArray = entry.entities;
          } 
          else if (typeof entry.entities === 'object' && entry.entities !== null) {
            entitiesArray = Object.entries(entry.entities).map(([key, value]) => {
              if (typeof value === 'object' && value !== null) {
                return {
                  name: 'name' in value ? String((value as any).name) : key,
                  type: 'type' in value ? String((value as any).type) : 'unknown'
                };
              }
              return { name: key, type: 'unknown' };
            });
          }
          
          // Process each entity, handling both object and string formats
          entitiesArray.forEach(entity => {
            // Skip invalid entities
            if (!isValidEntity(entity)) {
              return;
            }
            
            let entityName = '';
            let entityType = 'unknown';
            
            // Handle entity based on its format
            if (typeof entity === 'string') {
              entityName = entity.toLowerCase();
            } else if (typeof entity === 'object' && entity !== null) {
              entityName = entity.name.toLowerCase();
              
              if ('type' in entity && typeof entity.type === 'string') {
                entityType = entity.type;
              }
            }
            
            // Add entity to map if it's valid and not of type 'others'
            if (entityName && entityType !== 'others') {
              if (!entityMap.has(entityName)) {
                entityMap.set(entityName, { count: 0, totalSentiment: 0 });
              }
              
              const entityData = entityMap.get(entityName)!;
              entityData.count += 1;
              entityData.totalSentiment += sentimentScore;
            }
          });
        });
        
        // Convert map to array and calculate average sentiment
        const entitiesArray = Array.from(entityMap.entries()).map(([name, data]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          count: data.count,
          sentiment: data.totalSentiment / data.count
        }));
        
        // Sort by frequency and take top 7
        const topEntities = entitiesArray
          .sort((a, b) => b.count - a.count)
          .slice(0, 7);
        
        console.log('Top entities:', topEntities);
        setEntities(topEntities);
      } catch (error) {
        console.error('Error fetching entity data:', error);
        toast.error('Failed to load life areas');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEntities();
  }, [userId, timeRange]);
  
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
