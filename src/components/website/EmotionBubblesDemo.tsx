
import React, { useState } from 'react';
import { motion } from 'framer-motion';

// Demo component that shows floating emotion bubbles
const EmotionBubblesDemo = () => {
  // Define emotions with their colors, sizes (relative) and percentages
  const emotions = [
    { name: "Joy", color: "#8b5cf6", size: 1.6, percentage: 40 },
    { name: "Calm", color: "#06b6d4", size: 1.2, percentage: 25 },
    { name: "Hope", color: "#10b981", size: 1.3, percentage: 20 },
    { name: "Focus", color: "#f59e0b", size: 0.8, percentage: 10 },
    { name: "Inspired", color: "#ec4899", size: 0.9, percentage: 5 }
  ];

  const [selectedBubble, setSelectedBubble] = useState<number | null>(null);

  // Calculate sizes based on percentages
  const maxPercentage = Math.max(...emotions.map(e => e.percentage));
  const minSize = 14; // Minimum bubble size
  const maxSize = 50; // Maximum bubble size (increased for better contrast)

  const handleBubbleClick = (index: number) => {
    if (selectedBubble === index) {
      setSelectedBubble(null);
    } else {
      setSelectedBubble(index);
    }
  };

  return (
    <div className="w-full h-full relative">
      {emotions.map((emotion, index) => {
        // Calculate size using square root scale for better visual proportion
        // This ensures small percentages are still visible but large percentages are appropriately larger
        const sizeRatio = Math.sqrt(emotion.percentage / maxPercentage);
        const bubbleSize = minSize + (maxSize - minSize) * sizeRatio;
        
        return (
          <motion.div
            key={index}
            className="absolute rounded-full flex items-center justify-center cursor-pointer"
            style={{
              backgroundColor: emotion.color,
              width: `${bubbleSize}px`,
              height: `${bubbleSize}px`,
              fontSize: `${bubbleSize / 4}px`,
              color: 'white',
              fontWeight: 'bold',
              top: `${25 + Math.sin(index * 1.5) * 15}px`,
              left: `${(index * 16) % 95}%`,
              zIndex: Math.floor(emotion.percentage),
              boxShadow: `0 0 10px ${emotion.color}80`
            }}
            animate={{
              y: [0, -5, 0, 5, 0],
              scale: [1, 1.05, 1, 0.95, 1]
            }}
            whileTap={{ 
              scale: 1.1,
              transition: { duration: 0.2 } 
            }}
            onClick={() => handleBubbleClick(index)}
            // Ensure return to original size
            transition={{
              duration: 4 + index,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {emotion.name}
            
            {/* Single percentage popup that appears only when selected */}
            {selectedBubble === index && (
              <motion.div 
                className="absolute -top-8 bg-background border border-border shadow-md px-2 py-1 rounded-md text-xs font-semibold z-10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                {emotion.percentage}%
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default EmotionBubblesDemo;
