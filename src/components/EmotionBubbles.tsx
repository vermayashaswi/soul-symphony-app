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
    
    // Calculate minimum bubble size based on text length
    // This function determines the minimum size needed for a bubble to fit its text
    const calculateMinBubbleSize = (text: string): number => {
      // Base size depends on text length - longer text needs bigger bubbles
      const textLength = text.length;
      
      // Baseline minimum sizing:
      // - Very short text (1-5 chars): small bubble
      // - Medium text (6-12 chars): medium bubble
      // - Long text (13+ chars): larger bubble
      if (textLength <= 5) {
        return Math.min(availableWidth, availableHeight) * 0.15;
      } else if (textLength <= 12) {
        return Math.min(availableWidth, availableHeight) * 0.22;
      } else {
        return Math.min(availableWidth, availableHeight) * 0.28;
      }
    };
    
    // Process emotions or themes
    if (emotions && Object.keys(emotions).length > 0) {
      // Get max and min values for normalization
      const values = Object.values(emotions);
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);
      const valueRange = maxValue - minValue;
      
      // Calculate total available area for bubbles
      const totalArea = availableWidth * availableHeight * 0.7; // Use 70% of the available area
      
      // Calculate how many items we have
      const itemCount = Object.keys(emotions).length;
      
      // First pass: calculate base sizes based on text length
      const emotionEntries = Object.entries(emotions);
      const baseMinSizes = emotionEntries.map(([emotion, _]) => ({
        emotion,
        minSize: calculateMinBubbleSize(emotion)
      }));
      
      // Calculate max size based on container and item count
      const maxBubbleSize = Math.min(
        Math.min(availableWidth, availableHeight) * 0.4,
        Math.sqrt((totalArea) / (itemCount * Math.PI)) * 1.8
      );
      
      // Create emotion bubbles - now with text-aware sizing
      newItems = emotionEntries.map(([emotion, value], index) => {
        const minSize = baseMinSizes.find(item => item.emotion === emotion)?.minSize || 
                       Math.min(availableWidth, availableHeight) * 0.15;
        
        // Normalize the size between min and max size based on emotion value
        // Text length determines min size, emotion value determines scaling between min and max
        let size;
        if (valueRange === 0) {
          // If all emotions have the same value, just use the minimum size based on text
          size = minSize;
        } else {
          // Otherwise scale between min size (based on text) and max size (based on container)
          const normalizedValue = (value - minValue) / valueRange;
          size = minSize + (normalizedValue * (maxBubbleSize - minSize));
        }
        
        return {
          name: emotion,
          size,
          color: colorPalette[index % colorPalette.length],
          position: { x: 0, y: 0 } // Initial position, will be updated below
        };
      });
    } else if (themes && themes.length > 0) {
      // For themes, size based on text length
      const itemCount = themes.length;
      
      // Calculate appropriate bubble sizes for themes
      const totalArea = availableWidth * availableHeight * 0.7;
      const maxBubbleSize = Math.min(
        Math.min(availableWidth, availableHeight) * 0.35,
        Math.sqrt((totalArea) / (itemCount * Math.PI)) * 1.5
      );
      
      // Create theme bubbles
      newItems = themes.map((theme, index) => {
        // Calculate minimum size based on theme text length
        const minSize = calculateMinBubbleSize(theme);
        
        // For themes, use a more consistent size but still account for text length
        const size = Math.min(maxBubbleSize, Math.max(minSize, maxBubbleSize * 0.7));
        
        return {
          name: theme,
          size,
          color: colorPalette[index % colorPalette.length],
          position: { x: 0, y: 0 } // Initial position, will be updated below
        };
      });
    }
    
    // Position bubbles with better overlap prevention and text visibility
    if (newItems.length > 0) {
      // Sort by size (larger first) to prioritize larger bubbles in positioning
      newItems.sort((a, b) => b.size - a.size);
      
      // Position algorithm with more spread for visibility
      for (let i = 0; i < newItems.length; i++) {
        let isValidPosition = false;
        let attempts = 0;
        const maxAttempts = 70; // Increased attempts for better positioning
        
        // Spiral placement - starts from center and spirals outward
        const centerX = availableWidth / 2;
        const centerY = availableHeight / 2;
        let angle = 0;
        let radius = 0;
        const step = 0.5; // angular step
        
        while (!isValidPosition && attempts < maxAttempts) {
          // Adjust radius based on attempt number to create spiral pattern
          radius = (attempts / maxAttempts) * (Math.min(availableWidth, availableHeight) / 2 - newItems[i].size / 2);
          
          // Calculate position in spiral
          const x = padding + centerX + radius * Math.cos(angle);
          const y = padding + centerY + radius * Math.sin(angle);
          
          // Make sure bubble is within container bounds
          if (x - newItems[i].size/2 < padding || x + newItems[i].size/2 > availableWidth + padding ||
              y - newItems[i].size/2 < padding || y + newItems[i].size/2 > availableHeight + padding) {
            angle += step;
            attempts++;
            continue;
          }
          
          // Check for overlap with existing bubbles
          isValidPosition = true;
          for (let j = 0; j < i; j++) {
            const dx = x - newItems[j].position.x;
            const dy = y - newItems[j].position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            // Increased minimum distance to prevent text overlap
            const minDistance = (newItems[i].size + newItems[j].size) * 0.6;
            
            if (distance < minDistance) {
              isValidPosition = false;
              break;
            }
          }
          
          if (isValidPosition) {
            newItems[i].position = { x, y };
          } else {
            angle += step;
            attempts++;
          }
        }
        
        // If we couldn't find a valid position after max attempts,
        // use best effort placement with less strict overlap checking
        if (attempts >= maxAttempts) {
          // Find position with minimal overlap
          let bestPosition = { x: 0, y: 0 };
          let minOverlap = Number.MAX_VALUE;
          
          for (let attempt = 0; attempt < 30; attempt++) {
            const x = padding + Math.random() * (availableWidth - newItems[i].size);
            const y = padding + Math.random() * (availableHeight - newItems[i].size);
            
            let totalOverlap = 0;
            for (let j = 0; j < i; j++) {
              const dx = x - newItems[j].position.x;
              const dy = y - newItems[j].position.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const minDistance = (newItems[i].size + newItems[j].size) * 0.5;
              
              if (distance < minDistance) {
                totalOverlap += (minDistance - distance);
              }
            }
            
            if (totalOverlap < minOverlap) {
              minOverlap = totalOverlap;
              bestPosition = { x, y };
            }
          }
          
          newItems[i].position = bestPosition;
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
          <span className="font-medium px-1 text-center" style={{
            fontSize: `${Math.max(10, item.size / 4.5)}px`,
            lineHeight: '1.2',
            maxWidth: '90%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            wordBreak: 'break-word',
            textAlign: 'center',
            height: '100%',
            padding: '12%'
          }}>
            {item.name}
          </span>
        </motion.div>
      ))}
    </div>
  );
};

export default EmotionBubbles;
