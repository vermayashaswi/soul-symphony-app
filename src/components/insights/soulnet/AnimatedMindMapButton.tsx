
import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

interface AnimatedMindMapButtonProps {
  onClick: () => void;
}

const AnimatedMindMapButton: React.FC<AnimatedMindMapButtonProps> = ({ onClick }) => {
  return (
    <motion.button
      onClick={onClick}
      className="w-14 h-14 rounded-full bg-background border shadow-lg flex items-center justify-center"
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        animate={{ 
          rotate: 360,
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "linear"
        }}
      >
        <Activity className="h-6 w-6 text-primary" />
      </motion.div>
    </motion.button>
  );
};

export default AnimatedMindMapButton;
