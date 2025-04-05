
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
  
  // Enhanced vibrant color classes for theme boxes
  const colorClasses = [
    'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800 border border-blue-200',
    'bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-800 border border-indigo-200',
    'bg-gradient-to-br from-purple-100 to-purple-200 text-purple-800 border border-purple-200',
    'bg-gradient-to-br from-pink-100 to-pink-200 text-pink-800 border border-pink-200',
    'bg-gradient-to-br from-green-100 to-green-200 text-green-800 border border-green-200',
    'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-200',
    'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 border border-orange-200',
    'bg-gradient-to-br from-cyan-100 to-cyan-200 text-cyan-800 border border-cyan-200',
  ];

  // Animation variants for funky entrance effects
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.6, rotate: -5 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      rotate: 0,
      transition: { 
        type: "spring",
        stiffness: 300,
        damping: 15
      }
    }
  };

  // Filter out any empty themes
  const filteredThemes = themes ? themes.filter(theme => theme && theme.trim() !== '' && theme !== '•') : [];

  if (!themes || themes.length === 0 || filteredThemes.length === 0) {
    // Display placeholder theme boxes with smooth floating animation
    return (
      <div className={cn("flex flex-wrap gap-3 justify-center items-center h-full w-full", className)}>
        {[1, 2, 3].map((_, i) => (
          <motion.div
            key={`placeholder-${i}`}
            className="bg-gradient-to-r from-gray-100 to-gray-200 text-transparent rounded-lg h-12 shadow-sm"
            style={{ 
              width: isMobile ? '80px' : '120px',
              opacity: 0.5 - (i * 0.1) 
            }}
            animate={{ 
              y: [-(i+1) * 4, (i+1) * 4, -(i+1) * 4], 
              opacity: [0.4, 0.6, 0.4]
            }}
            transition={{ 
              y: { 
                duration: 3 + i * 0.5, 
                repeat: Infinity, 
                ease: "easeInOut" 
              },
              opacity: {
                duration: 3 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut"
              }
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
      {filteredThemes.map((theme, index) => {
        // Generate a random offset for the animation but ensure it's consistent
        const seed = (index + 1) * 0.2;
        
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
              boxShadow: "0 8px 20px -5px rgba(0, 0, 0, 0.15)",
              transition: { duration: 0.2 }
            }}
            animate={isDisturbed ? {
              // Smooth floating animation without flickering for disturbed state
              y: [(seed * -10), (seed * 10), (seed * -10)],
              x: [(seed * -5), (seed * 5), (seed * -5)],
              rotate: [(seed * -3), (seed * 3), (seed * -3)],
              transition: {
                y: { 
                  duration: 4 + seed * 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                },
                x: { 
                  duration: 5 + seed * 2, 
                  repeat: Infinity,
                  ease: "easeInOut"
                },
                rotate: { 
                  duration: 6 + seed, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }
            } : {
              // Subtle hover animation for normal state
              y: [0, -3 * seed, 0],
              transition: { 
                y: {
                  duration: 3 + seed * 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
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
