
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Entity {
  name: string;
  count: number;
  type?: string; // Add type property to the interface
}

interface EntityBubblesProps {
  entities: Entity[];
  className?: string;
}

const EntityBubbles: React.FC<EntityBubblesProps> = ({ entities, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [highlightedBubble, setHighlightedBubble] = useState<string | null>(null);
  
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

  // Filter out entities with type "others" and skip rendering if no valid entities or container not measured yet
  const filteredEntities = entities.filter(entity => entity.type !== 'others');
  
  if (!filteredEntities.length || dimensions.width === 0) {
    return <div ref={containerRef} className={cn("w-full h-24", className)}></div>;
  }

  // Find the max count to normalize sizes
  const maxCount = Math.max(...filteredEntities.map(e => e.count));
  
  // Calculate bubble size to fit three vertically
  const maxSize = Math.min(dimensions.width / 3, dimensions.height / 3);
  
  // Generate positions ensuring they spread across width
  const positions = filteredEntities.map((entity, index) => {
    // Size based on count but ensuring it's large enough to fit text
    const size = Math.max(
      30, // Minimum size
      (entity.count / maxCount) * maxSize // Proportional size
    );
    
    // Distribute across the width 
    const section = dimensions.width / filteredEntities.length;
    const baseX = index * section + (section / 2);
    
    // Random vertical position
    const maxTop = dimensions.height - size;
    const top = Math.random() * maxTop;
    
    // Random offset within the section to prevent overlapping
    const xOffset = (Math.random() - 0.5) * (section * 0.7);
    
    // Ensure the bubble stays within the container bounds
    const x = Math.max(size/2, Math.min(dimensions.width - size/2, baseX + xOffset));
    const y = Math.max(size/2, Math.min(dimensions.height - size/2, top + size/2));
    
    return { x, y, size };
  });

  return (
    <div 
      ref={containerRef} 
      className={cn("relative w-full overflow-hidden", className)}
    >
      {filteredEntities.map((entity, index) => {
        const { x, y, size } = positions[index];
        const opacity = 0.6 + (entity.count / maxCount) * 0.4; // Between 0.6 and 1.0
        const isHighlighted = highlightedBubble === entity.name;
        
        return (
          <motion.div
            key={entity.name}
            className={cn(
              "absolute flex items-center justify-center rounded-full text-xs font-medium text-primary shadow-sm transition-all duration-300",
              isHighlighted ? "bg-primary/30 ring-2 ring-primary/50" : "bg-primary/10",
              "cursor-pointer"
            )}
            initial={{ scale: 0, x: dimensions.width / 2, y: dimensions.height / 2 }}
            animate={{ 
              scale: isHighlighted ? 1.05 : 1, 
              x: [x, x + (Math.random() - 0.5) * 30, x - (Math.random() - 0.5) * 30, x],
              y: [y, y - (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 30, y],
              opacity: isHighlighted ? 1 : opacity,
              boxShadow: isHighlighted ? "0 0 15px rgba(var(--primary), 0.5)" : "none"
            }}
            transition={{ 
              type: "spring",
              stiffness: 50,
              damping: 10,
              repeat: Infinity,
              repeatType: "mirror",
              duration: 4 + Math.random() * 3,
              delay: index * 0.1
            }}
            style={{
              width: size,
              height: size,
              transform: `translate(-50%, -50%)`,
            }}
            onMouseEnter={() => setHighlightedBubble(entity.name)}
            onMouseLeave={() => setHighlightedBubble(null)}
            onTouchStart={() => setHighlightedBubble(entity.name)}
            onTouchEnd={() => setHighlightedBubble(null)}
          >
            <span className="text-2xs px-1 text-center" style={{ fontSize: '0.7rem' }}>
              {entity.name}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
};

export default EntityBubbles;
