
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
          className="w-full flex justify-center mb-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          <motion.span 
            className={`px-4 py-2 text-lg font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}
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
