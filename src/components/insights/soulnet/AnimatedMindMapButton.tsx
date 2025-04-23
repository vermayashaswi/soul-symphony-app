
import React from 'react';
import { motion } from 'framer-motion';
import { Layers3 } from 'lucide-react';

interface AnimatedMindMapButtonProps {
  onClick: () => void;
  className?: string;
}

const AnimatedMindMapButton: React.FC<AnimatedMindMapButtonProps> = ({ onClick, className = '' }) => {
  return (
    <motion.button
      onClick={onClick}
      className={`w-24 h-24 rounded-full bg-background border shadow-lg flex items-center justify-center relative overflow-hidden ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Central node */}
      <motion.div
        className="absolute w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
        animate={{
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Layers3 className="h-6 w-6 text-primary" />
      </motion.div>
      
      {/* Orbiting nodes */}
      {[0, 60, 120, 180, 240, 300].map((rotation, index) => (
        <motion.div
          key={rotation}
          className="absolute w-3 h-3 rounded-full bg-primary/20"
          initial={{ rotate: rotation }}
          animate={{
            rotate: [rotation, rotation + 360],
            scale: [1, 1.2, 1],
          }}
          transition={{
            rotate: {
              duration: 10,
              repeat: Infinity,
              ease: "linear"
            },
            scale: {
              duration: 2,
              repeat: Infinity,
              delay: index * 0.3,
              ease: "easeInOut"
            }
          }}
          style={{
            transformOrigin: "30px 30px"
          }}
        />
      ))}
      
      {/* Connection lines */}
      {[15, 75, 135, 195, 255, 315].map((rotation) => (
        <motion.div
          key={rotation}
          className="absolute h-[1px] w-8 bg-primary/20"
          initial={{ rotate: rotation }}
          animate={{
            rotate: [rotation, rotation + 360],
            opacity: [0.2, 0.5, 0.2]
          }}
          transition={{
            rotate: {
              duration: 10,
              repeat: Infinity,
              ease: "linear"
            },
            opacity: {
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }
          }}
          style={{
            transformOrigin: "0px 0px",
            left: "50%",
            top: "50%"
          }}
        />
      ))}
    </motion.button>
  );
};

export default AnimatedMindMapButton;
