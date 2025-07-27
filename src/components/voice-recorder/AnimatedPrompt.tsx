
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface AnimatedPromptProps {
  show: boolean;
}

export const AnimatedPrompt: React.FC<AnimatedPromptProps> = ({ show }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Use safe defaults to prevent theme provider errors during initialization
  const theme = 'light';
  
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
          className="w-full flex justify-center mt-4 mb-2 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <motion.div 
            className={`px-4 py-2 flex flex-col text-lg font-medium text-white`}
            animate={{ 
              scale: [1, 1.03, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          >
            <TranslatableText text="Speak in any language," />
            <TranslatableText text="I'll understand you!" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
