
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { TimeRange } from '@/hooks/use-insights-data';
import { toast } from 'sonner';
import { Json } from '@/types/journal';

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
          // RLS policies automatically filter to user's entries
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        
        if (error) {
          console.error('Error fetching entries:', error);
          throw error;
        }
        
        console.log(`Found ${entries?.length || 0} entries`);
        console.log('Sample entities data:', entries?.[0]?.entities);
        
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
            // Case 1: entities is a JSON string
            try {
              const parsed = JSON.parse(entry.entities);
              if (Array.isArray(parsed)) {
                entitiesArray = parsed;
              }
            } catch (e) {
              console.error('Failed to parse entities JSON:', e);
            }
          } 
          // Case 2: entities is already an array
          else if (Array.isArray(entry.entities)) {
            entitiesArray = entry.entities;
          } 
          // Case 3: entities is an object with properties
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
              console.log('Skipping invalid entity:', entity);
              return;
            }
            
            let entityName = '';
            let entityType = 'unknown';
            
            // Handle entity based on its format
            if (typeof entity === 'string') {
              // Simple string entity
              entityName = entity.toLowerCase();
            } else if (typeof entity === 'object' && entity !== null) {
              // Object entity with name property
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
        
        console.log(`Processed ${entitiesArray.length} entities`);
        
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
        console.log(`Container dimensions: ${offsetWidth}x${offsetHeight}`);
        
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
        <p className="text-muted-foreground">No life areas found in this time period</p>
      </div>
    );
  }
  
  // Calculate positions for bubbles
  const calculatePositions = () => {
    if (dimensions.width === 0 || dimensions.height === 0) {
      console.log('Invalid dimensions, using defaults');
      return [];
    }
    
    // Find the max count for bubble sizing
    const maxCount = Math.max(...entities.map(e => e.count));
    // Make bubbles smaller on mobile
    const minSize = isMobile ? 32 : 40; // Smaller minimum size
    // Ensure max size is proportional to viewport
    const maxSize = Math.min(dimensions.width / 4.5, isMobile ? 80 : 120); // Smaller on mobile
    
    console.log(`Calculating positions with dimensions: ${dimensions.width}x${dimensions.height}`);
    
    return entities.map((entity, i) => {
      // Calculate size based on frequency
      const size = minSize + ((entity.count / maxCount) * (maxSize - minSize));
      
      // Calculate position - distribute across space
      const angleStep = (2 * Math.PI) / entities.length;
      const angle = i * angleStep;
      
      // Use a tighter circular layout with less variation on mobile
      const radius = Math.min(dimensions.width, dimensions.height) * (isMobile ? 0.3 : 0.35); 
      const variation = isMobile ? 0.1 : 0.2; // Less randomness on mobile
      
      let x = dimensions.width / 2 + 
        radius * Math.cos(angle) * (1 + (Math.random() - 0.5) * variation);
      
      let y = dimensions.height / 2 + 
        radius * Math.sin(angle) * (1 + (Math.random() - 0.5) * variation);
      
      // Ensure bubbles stay fully within container bounds, accounting for their size
      x = Math.max(size/2, Math.min(dimensions.width - size/2, x));
      y = Math.max(size/2, Math.min(dimensions.height - size/2, y));
      
      return {
        entity,
        size,
        x,
        y
      };
    });
  };
  
  const positions = calculatePositions();
  console.log(`Generated ${positions.length} bubble positions`);
  
  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full h-full overflow-hidden", className)}
      style={{ minHeight: isMobile ? '250px' : '300px' }} // Smaller minimum height for mobile
    >
      {positions.map(({ entity, size, x, y }, bubbleIndex) => {
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
              delay: bubbleIndex * 0.05 
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
                fontSize: Math.max(10, size * 0.25),
                maxWidth: size * 0.9 // Ensure text doesn't overflow
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
