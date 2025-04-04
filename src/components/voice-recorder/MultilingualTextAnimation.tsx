
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
  // Calculate random position across the entire container (not just around center)
  const randomX = Math.random() * 100; // Random value 0-100%
  const randomY = Math.random() * 100; // Random value 0-100%
  
  // Create more dramatic off-screen starting positions
  const startX = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 300 + 200);
  const startY = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 200 + 100);
  const startScale = 0.5 + Math.random() * 0.5;
  
  // Calculate a depth/z-index so words appear at different layers
  const zIndex = Math.floor(Math.random() * 20);
  
  // Randomly determine opacity and size for variety
  const opacity = 0.6 + Math.random() * 0.4;
  const fontSize = 12 + Math.floor(Math.random() * 14); // Random font size between 12-26px
  
  // Use different animation timing for each word to create staggered effect
  const duration = 0.8 + Math.random() * 1.2;
  const delay = index * 0.05 + Math.random() * 0.2;
  
  // Create linear motion paths for constant velocity
  const floatDuration = 10 + Math.random() * 5; // Longer duration for slower, more constant movement
  
  return (
    <motion.div
      key={`word-${text}-${index}`}
      initial={{ 
        x: startX, 
        y: startY, 
        scale: startScale,
        opacity: 0,
        rotate: Math.random() * 20 - 10,
      }}
      animate={{ 
        // Position across the full container width/height (percentage-based)
        x: `${randomX}%`, 
        y: `${randomY}%`,
        scale: 0.8 + Math.random() * 0.4,
        opacity,
        rotate: Math.random() * 10 - 5,
      }}
      exit={{ 
        x: startX * -0.7, 
        y: startY * -0.7, 
        scale: startScale * 0.8, 
        opacity: 0,
        rotate: Math.random() * 30 - 15,
      }}
      transition={{ 
        duration,
        delay,
        ease: "linear", // Use linear easing for constant velocity
        x: {
          duration: floatDuration,
          repeat: Infinity,
          repeatType: "reverse", // Smooth back and forth movement
          ease: "linear" // Constant velocity
        },
        y: {
          duration: floatDuration + 1.5, // Slightly different timing for more organic movement
          repeat: Infinity,
          repeatType: "reverse", // Smooth back and forth movement
          ease: "linear" // Constant velocity
        }
      }}
      className="absolute select-none pointer-events-none text-foreground dark:text-foreground"
      style={{ 
        // Use absolute positioning with percentages
        left: `${randomX}%`,
        top: `${randomY}%`,
        // Subtract half of element size to center it at the position
        transform: `translate(-50%, -50%)`,
        zIndex, 
        fontFamily: "var(--font-sans)",
        fontWeight: Math.random() > 0.6 ? 700 : 400,
        fontSize: `${fontSize}px`,
        filter: Math.random() > 0.8 ? "blur(0.5px)" : "none", // Occasional blur for depth
        opacity: 0.2 + Math.random() * 0.3, // Very subtle opacity
      }}
    >
      {text}
    </motion.div>
  );
};

// Background language animation component showing words scattered across the space
export function LanguageBackground({ contained = false }: { contained?: boolean }) {
  const [visibleWords, setVisibleWords] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Display more languages to cover the container space better
    const updateWords = () => {
      // Increased word count for better distribution
      const wordCount = contained ? (35 + Math.floor(Math.random() * 10)) : (45 + Math.floor(Math.random() * 15));
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
    const interval = setInterval(updateWords, 3000);
    
    return () => clearInterval(interval);
  }, [contained]);
  
  return (
    <div 
      ref={containerRef}
      className={`${contained ? 'absolute inset-0 overflow-hidden' : 'fixed inset-0 overflow-hidden'} w-full h-full pointer-events-none`}
      style={{ zIndex: 0 }}
    >
      <div className="absolute inset-0 w-full h-full">
        <AnimatePresence>
          {visibleWords.map((word, index) => (
            <AnimatedWord 
              key={`${word}-${index}-${Math.random()}`} 
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
            transition={{ duration: 0.5, ease: "linear" }} 
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
