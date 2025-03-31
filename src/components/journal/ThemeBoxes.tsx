
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface ThemeBoxesProps {
  themes: string[];
  className?: string;
  isDisturbed?: boolean;
}

const ThemeBoxes: React.FC<ThemeBoxesProps> = ({ themes, className, isDisturbed = false }) => {
  const isMobile = useIsMobile();
  
  // Color classes for theme boxes - enhancing with more visually distinct colors
  const colorClasses = [
    'bg-blue-100 text-blue-800 border border-blue-200',
    'bg-indigo-100 text-indigo-800 border border-indigo-200',
    'bg-purple-100 text-purple-800 border border-purple-200',
    'bg-pink-100 text-pink-800 border border-pink-200',
    'bg-green-100 text-green-800 border border-green-200',
    'bg-yellow-100 text-yellow-800 border border-yellow-200',
    'bg-orange-100 text-orange-800 border border-orange-200',
    'bg-cyan-100 text-cyan-800 border border-cyan-200',
  ];

  // Filler themes to add small bubbles when there are few main themes
  const [fillerThemes, setFillerThemes] = useState<string[]>([]);
  
  useEffect(() => {
    // Generate filler bubbles if we have fewer than 5 main themes
    if (themes.length < 5) {
      const fillers = Array(8 - themes.length)
        .fill('')
        .map((_, i) => `•`); // Use bullet character for small bubbles
      setFillerThemes(fillers);
    } else {
      setFillerThemes([]);
    }
  }, [themes]);

  // All themes including fillers
  const allThemes = [...themes, ...fillerThemes];

  // Additional animation variants for floating effect
  const floatingAnimation = {
    initial: { y: 0 },
    animate: (i: number) => ({
      y: [0, -10, 0, 5, 0],
      transition: {
        duration: 4 + Math.random() * 2,
        repeat: Infinity,
        repeatType: "loop" as const,
        ease: "easeInOut",
        delay: i * 0.2
      }
    })
  };

  if (!themes || themes.length === 0) {
    // Display placeholder theme boxes with loading animation when no themes are present
    return (
      <div className={cn("flex flex-wrap gap-3 justify-center items-center h-full w-full", className)}>
        {[1, 2, 3, 4].map((_, i) => (
          <motion.div
            key={`placeholder-${i}`}
            className="bg-gray-100 text-transparent rounded-lg h-12 shadow-sm"
            style={{ 
              width: isMobile ? '80px' : '120px',
              opacity: 0.5 - (i * 0.1) 
            }}
            animate={{ 
              opacity: [0.3, 0.5, 0.3], 
              scale: [0.95, 1, 0.95] 
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              delay: i * 0.3 
            }}
          >
            &nbsp;
          </motion.div>
        ))}
        <div className="absolute text-sm text-muted-foreground">
          Extracting themes...
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2 md:gap-4 relative p-2 h-full w-full justify-center items-center", className)}>
      {allThemes.map((theme, index) => {
        // Determine if this is a filler (small) bubble
        const isFiller = index >= themes.length;
        
        // Generate a random offset for the animation
        const randomOffset = Math.random() * 0.5 + 0.5; // Between 0.5 and 1
        
        return (
          <motion.div
            key={`${theme}-${index}`}
            className={cn(
              "rounded-lg shadow-sm font-medium flex items-center justify-center",
              colorClasses[index % colorClasses.length],
              isFiller ? "opacity-40" : "opacity-100"
            )}
            style={{
              minWidth: isFiller ? (isMobile ? '40px' : '50px') : (isMobile ? '100px' : '140px'),
              height: isFiller ? (isMobile ? '40px' : '50px') : (isMobile ? '50px' : '60px'),
              fontSize: isFiller ? (isMobile ? '12px' : '14px') : (isMobile ? '14px' : '16px'),
              padding: isFiller ? '8px' : (isMobile ? '8px' : '12px'),
            }}
            initial={{ scale: 0, opacity: 0 }}
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
              y: [0, -5 * randomOffset, 0, 5 * randomOffset, 0],
              scale: [1, 1.02, 1, 0.98, 1],
              opacity: 1,
              transition: { 
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }}
            transition={{ 
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: index * 0.1
            }}
            whileHover={{ 
              scale: 1.1, 
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
              transition: { duration: 0.2 }
            }}
            custom={index}
            variants={floatingAnimation}
          >
            {theme}
          </motion.div>
        );
      })}
    </div>
  );
}

export default ThemeBoxes;
