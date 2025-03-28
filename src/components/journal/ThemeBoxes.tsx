
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ThemeBoxesProps {
  themes: string[];
  className?: string;
}

const ThemeBoxes: React.FC<ThemeBoxesProps> = ({ themes, className }) => {
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

  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {themes.map((theme, index) => (
        <motion.div
          key={theme}
          className={cn(
            "px-4 py-2 rounded-md font-medium text-sm",
            colorClasses[index % colorClasses.length]
          )}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: index * 0.1
          }}
          // Add a subtle floating animation
          whileInView={{
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
      ))}
    </div>
  );
};

export default ThemeBoxes;
