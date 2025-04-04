
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const languages = [
  { code: 'en', text: 'Speak your journal entry' },
  { code: 'es', text: 'Habla tu entrada de diario' },
  { code: 'fr', text: 'Parlez de votre journée' },
  { code: 'de', text: 'Sprechen Sie Ihren Tagebucheintrag' },
  { code: 'it', text: 'Parla del tuo diario' },
  { code: 'pt', text: 'Fale sua entrada no diário' },
  { code: 'ja', text: '日記を話してください' },
  { code: 'ko', text: '일기를 말해보세요' },
  { code: 'zh', text: '说出你的日记' },
  { code: 'ru', text: 'Расскажите о своем дне' },
  { code: 'ar', text: 'تحدث عن مذكراتك اليومية' },
  { code: 'hi', text: 'अपनी डायरी एंट्री बोलें' },
];

export function MultilingualTextAnimation() {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prevIndex => (prevIndex + 1) % languages.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const currentLanguage = languages[currentIndex];
  
  return (
    <div className="w-full text-center px-4 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentLanguage.code}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="text-2xl font-medium text-primary w-full"
        >
          {currentLanguage.text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function LanguageBackground({ contained = false }) {
  return (
    <div className={`w-full h-full flex flex-wrap justify-center content-center gap-6 opacity-10 ${contained ? 'px-4' : ''}`}>
      {languages.map((lang, index) => (
        <div 
          key={lang.code}
          className="text-lg text-muted-foreground font-medium"
          style={{ 
            transform: `rotate(${Math.random() * 20 - 10}deg) scale(${0.7 + Math.random() * 0.6})`,
            opacity: 0.1 + Math.random() * 0.4
          }}
        >
          {lang.text}
        </div>
      ))}
    </div>
  );
}
