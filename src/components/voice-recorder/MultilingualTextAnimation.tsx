
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Expanded language list
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

// Individual word animation component with enhanced random movement
const AnimatedWord: React.FC<AnimatedWordProps> = ({ text, index, total }) => {
  // Generate random position across the entire screen
  const positionGenerator = () => {
    return {
      x: Math.random() * 100,
      y: Math.random() * 100
    };
  };
  
  // Generate several random positions for movement path
  const generateRandomPath = (count = 5) => {
    const path = [];
    for (let i = 0; i < count; i++) {
      path.push({
        x: Math.random() * 100,
        y: Math.random() * 100
      });
    }
    return path;
  };
  
  // Generate consistent random values for this word
  const basePosition = useRef(positionGenerator());
  const movePath = useRef(generateRandomPath());
  const moveSpeed = useRef(25 + Math.random() * 35); // Random duration (25-60s) for slower movement
  const delay = useRef(index * 0.05); // Staggered delay
  
  // Visual properties
  const fontSize = useRef(8 + Math.floor(Math.random() * 6)); // 8-14px font size
  const opacity = useRef(0.2 + Math.random() * 0.3); // 0.2-0.5 opacity (increased transparency by ~50%)
  
  return (
    <motion.div
      key={`word-${text}-${index}`}
      initial={{ 
        x: basePosition.current.x + (Math.random() > 0.5 ? 100 : -100), 
        y: basePosition.current.y + (Math.random() > 0.5 ? 100 : -100), 
        opacity: 0,
        scale: 0.5,
      }}
      animate={{ 
        x: movePath.current.map(pos => `${pos.x}%`),
        y: movePath.current.map(pos => `${pos.y}%`),
        opacity: opacity.current,
        scale: 0.8 + Math.random() * 0.4,
      }}
      transition={{ 
        x: {
          duration: moveSpeed.current,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "linear",
          times: movePath.current.map((_, i) => i / (movePath.current.length - 1))
        },
        y: {
          duration: moveSpeed.current * 1.2, // Slightly different timing for more natural motion
          repeat: Infinity,
          repeatType: "mirror",
          ease: "linear",
          times: movePath.current.map((_, i) => i / (movePath.current.length - 1))
        },
        opacity: {
          duration: 0.8,
          delay: delay.current,
        },
        scale: {
          duration: 0.8,
          delay: delay.current,
        }
      }}
      className="absolute select-none pointer-events-none will-change-transform transform-gpu"
      style={{ 
        fontSize: `${fontSize.current}px`,
        opacity: opacity.current,
        transform: 'translate(-50%, -50%)',
        color: 'var(--foreground)', // Using CSS var for theme compatibility
      }}
    >
      {text}
    </motion.div>
  );
};

// Background language animation component with improved performance
export function LanguageBackground({ contained = false, isActive = true }: { contained?: boolean, isActive?: boolean }) {
  const [visibleWords, setVisibleWords] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isActive) {
      setVisibleWords([]);
      return;
    }
    
    // Adjusted word count for better performance and distribution
    const updateWords = () => {
      const wordCount = contained ? 25 : 40;
      
      // Create a set to avoid duplicates
      const selectedIndices = new Set<number>();
      const newWords: string[] = [];
      
      while (newWords.length < wordCount) {
        const randomIndex = Math.floor(Math.random() * languages.length);
        if (!selectedIndices.has(randomIndex)) {
          selectedIndices.add(randomIndex);
          newWords.push(languages[randomIndex]);
        }
      }
      
      setVisibleWords(newWords);
    };
    
    updateWords();
    // Reduced refresh rate for better performance
    const interval = setInterval(updateWords, 12000);
    
    return () => clearInterval(interval);
  }, [contained, isActive]);
  
  if (!isActive) return null;
  
  return (
    <div 
      ref={containerRef}
      className={`${contained ? 'absolute inset-0 overflow-hidden' : 'fixed inset-0 overflow-hidden'} w-full h-full pointer-events-none`}
      style={{ 
        zIndex: 0,
        perspective: "1000px",
        transformStyle: "preserve-3d",
      }}
    >
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
  );
}

// The original MultilingualTextAnimation component
export function MultilingualTextAnimation() {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % languages.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center w-full py-2 overflow-hidden">
      <div className="text-center relative h-8 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }} 
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="text-foreground">{languages[currentIndex]}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default MultilingualTextAnimation;
