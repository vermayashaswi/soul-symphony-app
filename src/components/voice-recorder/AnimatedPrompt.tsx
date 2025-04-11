
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from 'react-i18next';

interface AnimatedPromptProps {
  show: boolean;
}

export const AnimatedPrompt: React.FC<AnimatedPromptProps> = ({ show }) => {
  const [isVisible, setIsVisible] = useState(false);
  const { theme } = useTheme();
  const { t } = useTranslation();
  
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
          className="w-full flex justify-center mb-4 text-center"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <motion.div 
            className={`px-4 py-2 flex flex-col text-lg font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}
            animate={{ 
              scale: [1, 1.03, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          >
            <span>Speak in any language,</span>
            <span>I'll understand you!</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
