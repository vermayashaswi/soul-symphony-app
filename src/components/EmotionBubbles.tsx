
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface EmotionBubblesProps {
  emotions?: Record<string, number>;
  themes?: string[];
  className?: string;
}

const EmotionBubbles: React.FC<EmotionBubblesProps> = ({ emotions, themes, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [items, setItems] = useState<Array<{ name: string; size: number; color: string; position: { x: number; y: number } }>>([]);
  
  // Color palette for emotions and themes
  const colorPalette = [
    'bg-blue-100 text-blue-800', 
    'bg-green-100 text-green-800',
    'bg-yellow-100 text-yellow-800',
    'bg-purple-100 text-purple-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800',
    'bg-red-100 text-red-800',
    'bg-orange-100 text-orange-800',
    'bg-teal-100 text-teal-800',
  ];

  // Resize observer to handle container size changes
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    // Initialize size
    updateSize();
    
    // Create observer for responsive sizing
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);
    
    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, []);

  // Generate items when container size or data changes
  useEffect(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return;
    
    const padding = Math.min(containerSize.width, containerSize.height) * 0.1;
    const availableWidth = containerSize.width - padding * 2;
    const availableHeight = containerSize.height - padding * 2;
    
    let newItems: Array<{ name: string; size: number; color: string; position: { x: number; y: number } }> = [];
    
    // Process emotions or themes
    if (emotions && Object.keys(emotions).length > 0) {
      // Get max and min values for normalization
      const values = Object.values(emotions);
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);
      const valueRange = maxValue - minValue;
      
      // Normalize sizes based on container dimensions
      const minSize = Math.min(availableWidth, availableHeight) * 0.15;
      const maxSize = Math.min(availableWidth, availableHeight) * 0.3;
      
      // Calculate how many items we have
      const itemCount = Object.keys(emotions).length;
      // Adjust max size based on item count to prevent overcrowding
      const adjustedMaxSize = Math.min(
        maxSize,
        Math.sqrt((availableWidth * availableHeight) / (itemCount * Math.PI)) * 1.2
      );
      
      // Create emotion bubbles
      newItems = Object.entries(emotions).map(([emotion, value], index) => {
        // Normalize the size between min and max size
        const normalizedValue = valueRange === 0 
          ? 0.5 
          : (value - minValue) / valueRange;
        
        const size = minSize + (normalizedValue * (adjustedMaxSize - minSize));
        
        return {
          name: emotion,
          size,
          color: colorPalette[index % colorPalette.length],
          position: { x: 0, y: 0 } // Initial position, will be updated below
        };
      });
    } else if (themes && themes.length > 0) {
      // For themes, use a more consistent size
      const baseSize = Math.min(availableWidth, availableHeight) * 0.22;
      const itemCount = themes.length;
      
      // Adjust size based on item count
      const adjustedSize = Math.min(
        baseSize,
        Math.sqrt((availableWidth * availableHeight) / (itemCount * Math.PI)) * 1.2
      );
      
      // Create theme bubbles
      newItems = themes.map((theme, index) => ({
        name: theme,
        size: adjustedSize,
        color: colorPalette[index % colorPalette.length],
        position: { x: 0, y: 0 } // Initial position, will be updated below
      }));
    }
    
    // Position bubbles with overlap prevention
    if (newItems.length > 0) {
      // Sort by size (larger first) to prioritize larger bubbles in positioning
      newItems.sort((a, b) => b.size - a.size);
      
      for (let i = 0; i < newItems.length; i++) {
        let isValidPosition = false;
        let attempts = 0;
        const maxAttempts = 50;
        
        while (!isValidPosition && attempts < maxAttempts) {
          // Generate random position within boundaries
          const x = padding + Math.random() * (availableWidth - newItems[i].size);
          const y = padding + Math.random() * (availableHeight - newItems[i].size);
          
          // Check for overlap with existing bubbles
          isValidPosition = true;
          for (let j = 0; j < i; j++) {
            const dx = x - newItems[j].position.x;
            const dy = y - newItems[j].position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = (newItems[i].size + newItems[j].size) * 0.5;
            
            if (distance < minDistance) {
              isValidPosition = false;
              break;
            }
          }
          
          if (isValidPosition) {
            newItems[i].position = { x, y };
          }
          
          attempts++;
        }
        
        // If we couldn't find a valid position after max attempts,
        // just place it somewhere in the container
        if (attempts >= maxAttempts) {
          newItems[i].position = {
            x: padding + Math.random() * (availableWidth - newItems[i].size),
            y: padding + Math.random() * (availableHeight - newItems[i].size)
          };
        }
      }
    }
    
    setItems(newItems);
  }, [containerSize, emotions, themes]);

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "relative w-full h-full overflow-hidden rounded-md",
        className
      )}
    >
      {items.map((item, index) => (
        <motion.div
          key={item.name + index}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: 1, 
            scale: 1,
            x: item.position.x,
            y: item.position.y,
          }}
          transition={{ 
            duration: 0.6,
            delay: index * 0.1,
            type: "spring",
            damping: 10
          }}
          className={cn(
            "absolute rounded-full flex items-center justify-center",
            item.color
          )}
          style={{
            width: item.size,
            height: item.size,
            transform: `translate(${item.position.x}px, ${item.position.y}px)`,
          }}
        >
          <span className="text-xs font-medium px-1 text-center" style={{
            fontSize: `${Math.max(8, item.size / 5)}px`,
            lineHeight: '1.2',
            maxWidth: '90%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {item.name}
          </span>
        </motion.div>
      ))}
    </div>
  );
};

export default EmotionBubbles;
