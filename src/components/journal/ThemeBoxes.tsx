
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ThemeBoxesProps {
  themes: string[];
  className?: string;
  isDisturbed?: boolean;
}

const ThemeBoxes: React.FC<ThemeBoxesProps> = ({ themes, className, isDisturbed = false }) => {
  // Color classes for theme boxes
  const colorClasses = [
    'bg-blue-100 text-blue-800',
    'bg-indigo-100 text-indigo-800',
    'bg-purple-100 text-purple-800',
    'bg-pink-100 text-pink-800',
    'bg-green-100 text-green-800',
    'bg-yellow-100 text-yellow-800',
    'bg-orange-100 text-orange-800',
  ];

  // Filler themes to add small bubbles when there are few main themes
  const [fillerThemes, setFillerThemes] = useState<string[]>([]);
  
  useEffect(() => {
    // Generate filler bubbles if we have fewer than 5 main themes
    if (themes.length < 5) {
      const fillers = Array(12 - themes.length * 2)
        .fill('')
        .map((_, i) => `•`); // Use bullet character for small bubbles
      setFillerThemes(fillers);
    } else {
      setFillerThemes([]);
    }
  }, [themes]);

  // All themes including fillers
  const allThemes = [...themes, ...fillerThemes];

  // Calculate positions to prevent overlap
  const getBoxPositions = (count: number) => {
    const positions = [];
    const rows = Math.ceil(count / 3);
    const cols = Math.min(count, 3);
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        if (index < count) {
          positions.push({
            x: col * 33.3, // Distribute across available width
            y: row * 80    // Provide enough vertical space
          });
        }
      }
    }
    
    return positions;
  };
  
  const positions = getBoxPositions(allThemes.length);

  return (
    <div className={cn("flex flex-wrap gap-3 relative overflow-hidden", className)}>
      {allThemes.map((theme, index) => {
        // Determine if this is a filler (small) bubble
        const isFiller = index >= themes.length;
        
        // Different sizes for theme bubbles vs filler bubbles
        const bubbleSize = isFiller ? 
          { minWidth: '30px', height: '30px', fontSize: '10px' } : 
          { minWidth: '110px', height: '44px', fontSize: '16px' };
        
        // Ensure index is within bounds of positions array
        const position = index < positions.length ? positions[index] : { x: 0, y: 0 };
        
        return (
          <motion.div
            key={`${theme}-${index}`}
            className={cn(
              "px-4 py-2 rounded-md font-medium flex items-center justify-center",
              colorClasses[index % colorClasses.length],
              isFiller ? "opacity-40" : "opacity-100"
            )}
            style={bubbleSize}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: isFiller ? 0.4 : 1 }}
            transition={{ 
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: index * 0.1
            }}
            whileHover={{ scale: 1.1 }}
            // Apply different animations based on disturbance state
            animate={isDisturbed ? {
              x: [0, (Math.random() - 0.5) * 40, 0],
              y: [0, (Math.random() - 0.5) * 40, 0],
              rotate: [0, (Math.random() - 0.5) * 30, 0],
              scale: [1, 1.1, 1],
              transition: {
                duration: 2,
                ease: "easeInOut"
              }
            } : {
              y: [0, -5, 0, 5, 0],
              transition: { 
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }}
          >
            {theme}
          </motion.div>
        );
      })}
    </div>
  );
};

export default ThemeBoxes;
