
import React from 'react';
import { motion } from 'framer-motion';

interface FloatingDotsToggleProps {
  onClick: () => void;
}

export function FloatingDotsToggle({ onClick }: FloatingDotsToggleProps) {
  return (
    <div className="flex items-center cursor-pointer" onClick={onClick}>
      <motion.div 
        className="relative w-8 h-8"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {[0, 1, 2].map((i) => {
          const colors = [
            'bg-gradient-to-r from-blue-500 to-purple-500',
            'bg-gradient-to-r from-pink-500 to-orange-400',
            'bg-gradient-to-r from-green-400 to-cyan-500',
          ];
          
          // Define the orbital radius and angles
          const radius = 6;
          const baseAngle = (i * 2 * Math.PI) / 3; // Evenly space dots in a circle
          
          return (
            <motion.div
              key={i}
              className={`absolute w-2 h-2 rounded-full ${colors[i]}`}
              style={{ 
                left: '50%',
                top: '50%',
                x: -1, // Center dot horizontally (-1 for half of width)
                y: -1, // Center dot vertically (-1 for half of height)
              }}
              animate={{
                x: [
                  Math.cos(baseAngle) * radius - 1, 
                  Math.cos(baseAngle + Math.PI/2) * radius - 1,
                  Math.cos(baseAngle + Math.PI) * radius - 1,
                  Math.cos(baseAngle + 1.5 * Math.PI) * radius - 1,
                  Math.cos(baseAngle) * radius - 1
                ],
                y: [
                  Math.sin(baseAngle) * radius - 1,
                  Math.sin(baseAngle + Math.PI/2) * radius - 1,
                  Math.sin(baseAngle + Math.PI) * radius - 1,
                  Math.sin(baseAngle + 1.5 * Math.PI) * radius - 1,
                  Math.sin(baseAngle) * radius - 1
                ],
                boxShadow: [
                  '0 0 2px rgba(255, 255, 255, 0.5)',
                  '0 0 4px rgba(255, 255, 255, 0.7)',
                  '0 0 2px rgba(255, 255, 255, 0.5)',
                ],
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
                }
              }}
            />
          );
        })}
      </motion.div>
      
      {/* Colored "Themes" text */}
      <motion.div 
        className="ml-1 text-sm font-medium flex"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">TH</span>
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-orange-400">EM</span>
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-500">ES</span>
      </motion.div>
    </div>
  );
}

export default FloatingDotsToggle;
