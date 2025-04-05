
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

// Individual word animation component with improved smooth movement
const AnimatedWord: React.FC<AnimatedWordProps> = ({ text, index, total }) => {
  // Calculate random position across the entire container with better distribution
  const randomX = useRef(Math.random() * 80 + 10); // Random value 10-90% (avoid edges)
  const randomY = useRef(Math.random() * 80 + 10); // Random value 10-90% (avoid edges)
  
  // Create smooth off-screen starting positions
  const startX = useRef((Math.random() > 0.5 ? 1 : -1) * (Math.random() * 200 + 100));
  const startY = useRef((Math.random() > 0.5 ? 1 : -1) * (Math.random() * 100 + 50));
  const startScale = useRef(0.5 + Math.random() * 0.2);
  
  // Fixed layer values to prevent z-fighting and reduce repaints
  const zIndex = useRef(Math.floor(Math.random() * 10));
  
  // More consistent opacity and size
  const opacity = useRef(0.4 + Math.random() * 0.4);
  const fontSize = useRef(10 + Math.floor(Math.random() * 12)); // Random font size between 10-22px
  
  // Smoother animation timing with more consistent values
  const duration = useRef(10 + Math.random() * 20); // Much longer for smoother effect
  const delay = useRef(index * 0.02);
  
  return (
    <motion.div
      key={`word-${text}-${index}`}
      initial={{ 
        x: startX.current, 
        y: startY.current, 
        scale: startScale.current,
        opacity: 0,
      }}
      animate={{ 
        x: `${randomX.current}%`, 
        y: `${randomY.current}%`,
        scale: 0.8 + Math.random() * 0.2,
        opacity: opacity.current,
      }}
      exit={{ 
        opacity: 0,
        transition: { duration: 0.5 }
      }}
      transition={{ 
        x: {
          type: "spring",
          stiffness: 5,
          damping: 20,
          duration: duration.current,
          repeat: Infinity,
          repeatType: "mirror",
        },
        y: {
          type: "spring",
          stiffness: 5,
          damping: 20,
          duration: duration.current + 5,
          repeat: Infinity,
          repeatType: "mirror",
        },
        opacity: {
          duration: 1,
          delay: delay.current
        },
        scale: {
          duration: 1,
          delay: delay.current
        }
      }}
      className="absolute select-none pointer-events-none will-change-transform"
      style={{ 
        left: `${randomX.current}%`,
        top: `${randomY.current}%`,
        transform: `translate(-50%, -50%)`,
        zIndex: zIndex.current, 
        fontFamily: "var(--font-sans)",
        fontWeight: Math.random() > 0.6 ? 500 : 400,
        fontSize: `${fontSize.current}px`,
        opacity: opacity.current,
        color: 'var(--foreground)', // Using CSS var for theme compatibility
      }}
    >
      {text}
    </motion.div>
  );
};

// Background language animation component with improved performance
export function LanguageBackground({ contained = false }: { contained?: boolean }) {
  const [visibleWords, setVisibleWords] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Reduced words count for better performance and smoother animations
    const updateWords = () => {
      const wordCount = contained ? 20 : 30;
      const newWords: string[] = [];
      
      // Create a set to avoid duplicates
      const selectedIndices = new Set<number>();
      
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
    // Slower refresh rate for better performance
    const interval = setInterval(updateWords, 8000);
    
    return () => clearInterval(interval);
  }, [contained]);
  
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
      <div className="absolute inset-0 w-full h-full">
        <AnimatePresence>
          {visibleWords.map((word, index) => (
            <AnimatedWord 
              key={`${word}-${index}`} // Simplified key to reduce rerenders
              text={word} 
              index={index} 
              total={visibleWords.length} 
            />
          ))}
        </AnimatePresence>
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
