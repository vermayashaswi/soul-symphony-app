
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedPromptProps {
  show: boolean;
}

export const AnimatedPrompt: React.FC<AnimatedPromptProps> = ({ show }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    // Small delay to make sure the animation runs properly
    if (show) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show]);
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          className="w-full flex justify-center mb-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <motion.span 
            className="px-4 py-2 text-lg font-medium text-white dark:bg-theme-color/90 bg-theme-color/95 rounded-full shadow-md backdrop-blur-sm"
            animate={{ 
              scale: [1, 1.03, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          >
            Speak in any language!!
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
