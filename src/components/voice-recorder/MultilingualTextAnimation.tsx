
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Expanded language list with more options
const languages = [
  "English", "Español", "Français", "Deutsch", "Italiano", "Português", 
  "Русский", "日本語", "한국어", "中文", "العربية", "हिन्दी", "Tiếng Việt", 
  "Nederlands", "Svenska", "Polski", "Türkçe", "ไทย", "Bahasa Indonesia", 
  "فارسی", "עברית", "Ελληνικά", "Čeština", "Magyar", "Română", "Українська",
  "भाषा", "ਪੰਜਾਬੀ", "বাংলা", "ગુજરાતી", "తెలుగు", "മലയാളം", "ಕನ್ನಡ", "অসমীয়া",
  "मराठी", "اردو", "বাঙালি", "தமிழ்", "Kiswahili", "Монгол", "ဗမာစာ", "ខ្មែរ",
  "Afrikaans", "Shqip", "Հայերեն", "Azərbaycan", "Euskara", "Беларуская", "Български",
  "Català", "Hrvatski", "Dansk", "Eesti", "Suomi", "Gaeilge", "Galego", "ქართული",
  "Қазақ", "Кыргызча", "Latviešu", "Lietuvių", "Македонски", "Melayu", "Norsk",
  "سنڌي", "Српски", "Slovenčina", "Slovenščina", "Af Soomaali", "Sesotho", "Tagalog"
];

interface AnimatedWordProps {
  text: string;
  index: number;
  total: number;
}

// Individual word animation component with randomized movement
const AnimatedWord: React.FC<AnimatedWordProps> = ({ text, index, total }) => {
  // Calculate random positions for words to appear from off-screen
  const startX = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 100 + 200);
  const startY = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 60 + 100);
  const startScale = 0.7 + Math.random() * 0.6;
  
  // Calculate a depth/z-index so words appear at different layers
  const zIndex = Math.floor(Math.random() * 10);
  
  // Randomly determine opacity and size for variety
  const opacity = 0.7 + Math.random() * 0.3;
  const fontSize = 14 + Math.floor(Math.random() * 6); // Random font size between 14-20px
  
  // Use different animation timing for each word to create staggered effect
  const duration = 0.8 + Math.random() * 0.7;
  const delay = index * 0.07;
  
  // Create random floating effect for more organic movement
  const floatX = Math.random() * 20 - 10; // Random value between -10 and 10
  const floatY = Math.random() * 20 - 10; // Random value between -10 and 10
  const floatDuration = 3 + Math.random() * 4; // Random duration between 3-7s
  
  return (
    <motion.div
      key={`word-${text}-${index}`}
      initial={{ 
        x: startX, 
        y: startY, 
        scale: startScale,
        opacity: 0 
      }}
      animate={{ 
        x: [0, floatX, 0, -floatX, 0], // Create a small random floating path
        y: [0, floatY, 0, -floatY, 0], // Create a small random floating path
        scale: 1,
        opacity 
      }}
      exit={{ 
        x: -startX, 
        y: -startY, 
        scale: startScale, 
        opacity: 0 
      }}
      transition={{ 
        duration,
        delay,
        ease: "easeOut",
        x: {
          duration: floatDuration,
          repeat: Infinity,
          ease: "easeInOut"
        },
        y: {
          duration: floatDuration + 1, // Slightly different timing for more organic movement
          repeat: Infinity,
          ease: "easeInOut"
        }
      }}
      className="absolute select-none pointer-events-none"
      style={{ 
        zIndex, 
        fontFamily: "var(--font-sans)",
        fontWeight: Math.random() > 0.7 ? 700 : 400,
        fontSize: `${fontSize}px`,
      }}
    >
      {text}
    </motion.div>
  );
};

// Background language animation component showing words moving in 3D space
export function LanguageBackground({ contained = false }: { contained?: boolean }) {
  const [visibleWords, setVisibleWords] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Display a subset of languages at any given time
    const updateWords = () => {
      // Randomly select 8-16 words to show at once for better performance within container
      const wordCount = contained ? (8 + Math.floor(Math.random() * 8)) : (12 + Math.floor(Math.random() * 12));
      const newWords: string[] = [];
      
      for (let i = 0; i < wordCount; i++) {
        const randomIndex = Math.floor(Math.random() * languages.length);
        newWords.push(languages[randomIndex]);
      }
      
      setVisibleWords(newWords);
    };
    
    updateWords();
    const interval = setInterval(updateWords, 3000);
    
    return () => clearInterval(interval);
  }, [contained]);
  
  return (
    <div 
      ref={containerRef}
      className={`${contained ? 'absolute inset-0' : 'fixed inset-0'} w-full h-full overflow-hidden pointer-events-none`}
      style={{ zIndex: 0 }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`relative ${contained ? 'w-full h-full' : 'w-full h-full max-w-4xl'}`}>
          <AnimatePresence>
            {visibleWords.map((word, index) => (
              <AnimatedWord 
                key={`${word}-${index}`} 
                text={word} 
                index={index} 
                total={visibleWords.length} 
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// The original MultilingualTextAnimation component with enhanced animations
export function MultilingualTextAnimation() {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % languages.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center py-2 overflow-hidden">
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
    </div>
  );
}

export default MultilingualTextAnimation;
