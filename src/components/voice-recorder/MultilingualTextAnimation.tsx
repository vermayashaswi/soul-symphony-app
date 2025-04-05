
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
  // Calculate position that covers the entire container evenly
  const positionGenerator = () => {
    // Divide the container into a grid and place words evenly
    const gridSize = Math.ceil(Math.sqrt(total));
    const cellSize = 100 / gridSize;
    
    // Get a position within the grid, then add some randomness
    const gridX = (index % gridSize) * cellSize;
    const gridY = Math.floor(index / gridSize) * cellSize;
    
    // Add randomness within the cell
    const x = gridX + (Math.random() * cellSize * 0.6);
    const y = gridY + (Math.random() * cellSize * 0.6);
    
    return { x, y };
  };
  
  // Generate consistent random values for this word
  const basePosition = useRef(positionGenerator());
  const moveRadius = useRef(5 + Math.random() * 10); // Random movement radius (5-15px)
  const moveSpeed = useRef(15 + Math.random() * 15); // Random duration (15-30s)
  const delay = useRef(index * 0.03); // Staggered delay for smoother initial appearance
  
  // Visual properties
  const fontSize = useRef(10 + Math.floor(Math.random() * 8)); // 10-18px font size
  const opacity = useRef(0.5 + Math.random() * 0.5); // 0.5-1.0 opacity
  const zIndex = useRef(Math.floor(Math.random() * 10)); // Random z-index for layering
  
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
        x: [
          basePosition.current.x,
          basePosition.current.x + moveRadius.current,
          basePosition.current.x - moveRadius.current,
          basePosition.current.x,
        ],
        y: [
          basePosition.current.y,
          basePosition.current.y - moveRadius.current,
          basePosition.current.y + moveRadius.current,
          basePosition.current.y,
        ],
        opacity: opacity.current,
        scale: 0.8 + Math.random() * 0.4,
      }}
      transition={{ 
        x: {
          duration: moveSpeed.current,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        },
        y: {
          duration: moveSpeed.current + 5, // Slightly different timing for more natural motion
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
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
        left: `${basePosition.current.x}%`,
        top: `${basePosition.current.y}%`,
        fontSize: `${fontSize.current}px`,
        opacity: opacity.current,
        zIndex: zIndex.current, 
        transform: 'translate(-50%, -50%)',
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
    // Adjusted word count for better performance and distribution
    const updateWords = () => {
      const wordCount = contained ? 25 : 35;
      
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
