
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
  
  // Generate random positions ensuring they don't overlap too much
  const positions = filteredEntities.map((entity, index) => {
    const size = 20 + (entity.count / maxCount) * 30; // Size between 20px and 50px
    
    // Distribute across the width
    const section = dimensions.width / filteredEntities.length;
    const baseX = index * section + (section / 2);
    
    // Random offset within the section
    const xOffset = (Math.random() - 0.5) * section * 0.8;
    const yOffset = (Math.random() - 0.5) * dimensions.height * 0.6;
    
    // Ensure the bubble stays within the container bounds
    const x = Math.max(size/2, Math.min(dimensions.width - size/2, baseX + xOffset));
    const y = Math.max(size/2, Math.min(dimensions.height - size/2, dimensions.height/2 + yOffset));
    
    return { x, y, size };
  });

  return (
    <div 
      ref={containerRef} 
      className={cn("relative w-full overflow-hidden", className)}
    >
      {filteredEntities.map((entity, index) => {
        const { x, y, size } = positions[index];
        const opacity = 0.5 + (entity.count / maxCount) * 0.5; // Between 0.5 and 1.0
        
        return (
          <motion.div
            key={entity.name}
            className="absolute flex items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary shadow-sm"
            initial={{ scale: 0, x: dimensions.width / 2, y: dimensions.height / 2 }}
            animate={{ 
              scale: 1, 
              x: [x, x + (Math.random() - 0.5) * 40, x - (Math.random() - 0.5) * 30, x],
              y: [y, y - (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 30, y],
              opacity
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
          >
            {entity.name}
          </motion.div>
        );
      })}
    </div>
  );
};

export default EntityBubbles;
