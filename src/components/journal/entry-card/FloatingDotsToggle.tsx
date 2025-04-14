
import React from 'react';
import { motion } from 'framer-motion';

interface FloatingDotsToggleProps {
  onClick: () => void;
  isExpanded: boolean;
}

export function FloatingDotsToggle({ onClick, isExpanded }: FloatingDotsToggleProps) {
  // Add a wrapper function to log when toggle is clicked
  const handleClick = () => {
    console.log('[FloatingDotsToggle] Toggle clicked, current state:', isExpanded);
    onClick();
  };

  return (
    <motion.div 
      className="relative w-8 h-8 cursor-pointer flex items-center justify-center"
      onClick={handleClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label={isExpanded ? "Hide themes" : "Show themes"}
    >
      {[0, 1, 2].map((i) => {
        const colors = [
          'bg-gradient-to-r from-blue-500 to-purple-500',
          'bg-gradient-to-r from-pink-500 to-orange-400',
          'bg-gradient-to-r from-green-400 to-cyan-500',
        ];
        
        const radius = 10;
        const baseAngle = (i * 2 * Math.PI) / 3; // Evenly space dots in a circle
        
        return (
          <motion.div
            key={i}
            className={`absolute w-3 h-3 rounded-full ${colors[i]}`}
            style={{ 
              left: '50%',
              top: '50%',
              x: Math.cos(baseAngle) * radius - 1.5, // Center dot horizontally (1.5 is half of width)
              y: Math.sin(baseAngle) * radius - 1.5, // Center dot vertically (1.5 is half of height)
            }}
            animate={{
              x: [
                Math.cos(baseAngle) * radius - 1.5, 
                Math.cos(baseAngle + Math.PI/2) * radius - 1.5,
                Math.cos(baseAngle + Math.PI) * radius - 1.5,
                Math.cos(baseAngle + 1.5 * Math.PI) * radius - 1.5,
                Math.cos(baseAngle) * radius - 1.5
              ],
              y: [
                Math.sin(baseAngle) * radius - 1.5,
                Math.sin(baseAngle + Math.PI/2) * radius - 1.5,
                Math.sin(baseAngle + Math.PI) * radius - 1.5,
                Math.sin(baseAngle + 1.5 * Math.PI) * radius - 1.5,
                Math.sin(baseAngle) * radius - 1.5
              ],
              boxShadow: [
                '0 0 2px rgba(255, 255, 255, 0.5)',
                '0 0 4px rgba(255, 255, 255, 0.7)',
                '0 0 2px rgba(255, 255, 255, 0.5)',
              ],
              scale: isExpanded ? [1, 1.1, 1] : 1,
            }}
            transition={{
              x: {
                duration: 4,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.3,
              },
              y: {
                duration: 4,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.3,
              },
              boxShadow: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.3
              },
              scale: {
                duration: 1,
                repeat: isExpanded ? Infinity : 0,
                ease: "easeInOut"
              }
            }}
          />
        );
      })}
    </motion.div>
  );
}

export default FloatingDotsToggle;
