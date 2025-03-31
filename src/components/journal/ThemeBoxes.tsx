
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

  // Animation variants for floating and entrance effects
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.8 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        type: "spring",
        stiffness: 260,
        damping: 20
      }
    }
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
    <motion.div 
      className={cn("flex flex-wrap gap-3 md:gap-4 justify-center items-center h-full w-full p-2", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {themes.map((theme, index) => {
        // Generate a random offset for the animation
        const randomOffset = Math.random() * 0.5 + 0.5; // Between 0.5 and 1
        
        return (
          <motion.div
            key={`${theme}-${index}`}
            className={cn(
              "rounded-lg shadow-sm font-medium flex items-center justify-center px-4 py-2",
              colorClasses[index % colorClasses.length],
            )}
            variants={itemVariants}
            whileHover={{ 
              scale: 1.05, 
              boxShadow: "0 8px 20px -5px rgba(0, 0, 0, 0.1)",
              transition: { duration: 0.2 }
            }}
            animate={isDisturbed ? {
              x: [0, (Math.random() - 0.5) * 20, 0],
              y: [0, (Math.random() - 0.5) * 20, 0],
              rotate: [0, (Math.random() - 0.5) * 10, 0],
              transition: {
                duration: 1.5,
                ease: "easeInOut"
              }
            } : {
              y: [0, -3 * randomOffset, 0, 3 * randomOffset, 0],
              transition: { 
                duration: 3 + Math.random() * 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.1
              }
            }}
          >
            {theme}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default ThemeBoxes;
