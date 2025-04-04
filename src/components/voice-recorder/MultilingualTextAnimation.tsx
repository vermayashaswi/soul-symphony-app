
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const languages = [
  "English", "Español", "Français", "Deutsch", "Italiano", "Português", 
  "Русский", "日本語", "한국어", "中文", "العربية", "हिन्दी", "Tiếng Việt", 
  "Nederlands", "Svenska", "Polskie", "Türkçe", "ไทย", "Bahasa Indonesia", 
  "فارسی", "עברית", "Ελληνικά", "Čeština", "Magyar", "Română", "Українська"
];

export function MultilingualTextAnimation() {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % languages.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center py-4 overflow-hidden">
      <div className="text-center relative h-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="text-muted-foreground">{languages[currentIndex]}</span>
          </motion.div>
        </AnimatePresence>
      </div>
      <motion.div 
        className="text-xs text-muted-foreground mt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Record in any language of your choice
      </motion.div>
    </div>
  );
}

export default MultilingualTextAnimation;
