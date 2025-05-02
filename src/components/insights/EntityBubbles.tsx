
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { TimeRange } from '@/hooks/use-insights-data';

type Entity = {
  name: string;
  count: number;
  sentiment: number;
};

interface EntityBubblesProps {
  userId?: string;
  timeRange: TimeRange;
  onEntityClick?: (entity: string, sentiment: number) => void;
  className?: string;
}

const EntityBubbles: React.FC<EntityBubblesProps> = ({
  userId,
  timeRange,
  onEntityClick,
  className
}) => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedEntity, setHighlightedEntity] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
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
  
  // Function to get sentiment color
  const getSentimentColor = (sentiment: number): string => {
    if (sentiment <= -0.3) return '#ea384c'; // Red for negative
    if (sentiment >= 0.3) return '#48BB78';  // Green for positive
    return '#FBBF24';                        // Yellow for neutral
  };
  
  // Fetch entities and their sentiments
  useEffect(() => {
    const fetchEntities = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange();
        
        // Query journal entries within the time range
        const { data: entries, error } = await supabase
          .from('Journal Entries')
          .select('entities, sentiment')
          .eq('user_id', userId)
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        
        if (error) throw error;
        
        // Process entries to extract entities and calculate sentiments
        const entityMap = new Map<string, { count: number, totalSentiment: number }>();
        
        entries?.forEach(entry => {
          if (!entry.entities || !entry.sentiment) return;
          
          let entitiesArray: Array<{ name: string, type: string }> = [];
          
          // Parse entities if it's a string
          if (typeof entry.entities === 'string') {
            try {
              entitiesArray = JSON.parse(entry.entities);
            } catch (e) {
              console.error('Failed to parse entities JSON:', e);
            }
          } 
          // Handle if entities is already an array
          else if (Array.isArray(entry.entities)) {
            entitiesArray = entry.entities;
          }
          // Handle if entities is an object with properties
          else if (typeof entry.entities === 'object') {
            entitiesArray = Object.entries(entry.entities).map(([key, value]) => ({
              name: typeof value === 'object' && value !== null && 'name' in value
                ? (value as any).name
                : key,
              type: typeof value === 'object' && value !== null && 'type' in value
                ? (value as any).type
                : 'unknown'
            }));
          }
          
          // Extract sentiment score
          const sentimentScore = parseFloat(entry.sentiment);
          
          // Only process valid entities and sentiment
          if (!isNaN(sentimentScore)) {
            entitiesArray.forEach(entity => {
              if (entity && entity.name && entity.type !== 'others') {
                const entityName = entity.name.toLowerCase();
                
                if (!entityMap.has(entityName)) {
                  entityMap.set(entityName, { count: 0, totalSentiment: 0 });
                }
                
                const entityData = entityMap.get(entityName)!;
                entityData.count += 1;
                entityData.totalSentiment += sentimentScore;
              }
            });
          }
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
        
        setEntities(topEntities);
      } catch (error) {
        console.error('Error fetching entity data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEntities();
  }, [userId, timeRange]);
  
  // Update dimensions on resize
  useEffect(() => {
    if (containerRef.current) {
      const updateDimensions = () => {
        setDimensions({
          width: containerRef.current?.offsetWidth || 0,
          height: containerRef.current?.offsetHeight || 0
        });
      };
      
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      
      return () => {
        window.removeEventListener('resize', updateDimensions);
      };
    }
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
        <p className="text-muted-foreground">No life areas found in this time period</p>
      </div>
    );
  }
  
  // Calculate positions for bubbles
  const calculatePositions = () => {
    if (dimensions.width === 0) return [];
    
    // Find the max count for bubble sizing
    const maxCount = Math.max(...entities.map(e => e.count));
    const minSize = 40; // Minimum size in pixels
    const maxSize = Math.min(dimensions.width / 4, 120); // Maximum size
    
    return entities.map((entity, index) => {
      // Calculate size based on frequency
      const size = minSize + ((entity.count / maxCount) * (maxSize - minSize));
      
      // Calculate position - distribute across space
      const angleStep = (2 * Math.PI) / entities.length;
      const angle = index * angleStep;
      
      // Use a circular layout with some variation
      const radius = Math.min(dimensions.width, dimensions.height) * 0.35; 
      const variation = 0.2; // Add some randomness
      
      const x = dimensions.width / 2 + 
        radius * Math.cos(angle) * (1 + (Math.random() - 0.5) * variation);
      
      const y = dimensions.height / 2 + 
        radius * Math.sin(angle) * (1 + (Math.random() - 0.5) * variation);
      
      return {
        entity,
        size,
        x: Math.max(size/2, Math.min(dimensions.width - size/2, x)),
        y: Math.max(size/2, Math.min(dimensions.height - size/2, y))
      };
    });
  };
  
  const positions = calculatePositions();
  
  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full h-full", className)}
    >
      {positions.map(({ entity, size, x, y }) => {
        const isHighlighted = highlightedEntity === entity.name;
        const sentimentColor = getSentimentColor(entity.sentiment);
        
        return (
          <motion.div
            key={entity.name}
            className={cn(
              "absolute flex items-center justify-center rounded-full cursor-pointer transition-all",
              "text-foreground shadow-md",
              isHighlighted ? "z-10" : "z-0"
            )}
            style={{
              width: size,
              height: size,
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)',
              backgroundColor: sentimentColor,
              opacity: isHighlighted ? 0.95 : 0.7
            }}
            initial={{ scale: 0 }}
            animate={{ 
              scale: isHighlighted ? 1.1 : 1,
              boxShadow: isHighlighted ? '0 0 15px rgba(0,0,0,0.2)' : '0 0 5px rgba(0,0,0,0.1)'
            }}
            transition={{ 
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: index * 0.05 
            }}
            onMouseEnter={() => setHighlightedEntity(entity.name)}
            onMouseLeave={() => setHighlightedEntity(null)}
            onClick={() => onEntityClick?.(entity.name, entity.sentiment)}
          >
            <div className="text-center p-1">
              <div className={cn(
                "font-medium truncate px-2",
                "text-center",
                isHighlighted ? "text-white" : "text-white/90"
              )} style={{ 
                fontSize: Math.max(10, size * 0.25) 
              }}>
                {entity.name}
              </div>
              
              {isHighlighted && (
                <div className="text-white/90 text-xs mt-1">
                  {entity.sentiment.toFixed(1)}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default EntityBubbles;
