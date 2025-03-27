
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface EmotionBubblesProps {
  themes?: string[];
  emotions?: Record<string, number>;
}

interface BubbleProps {
  x: number;
  y: number;
  size: number;
  delay: number;
  children: React.ReactNode;
}

// More accurate emotion to emoji mapping
const EMOTION_EMOJIS: Record<string, string> = {
  // Positive emotions
  joy: '😄',
  happiness: '😊',
  love: '❤️',
  gratitude: '🙏',
  excitement: '🤩',
  contentment: '😌',
  calm: '😌',
  peaceful: '😇',
  hope: '🌱',
  relief: '😮‍💨',
  pride: '🦚',
  satisfaction: '👍',
  
  // Negative emotions
  sadness: '😢',
  anger: '😠',
  fear: '😨',
  anxiety: '😰',
  stress: '😖',
  disappointment: '😞',
  frustration: '😤',
  grief: '😭',
  shame: '😳',
  guilt: '😔',
  jealousy: '😒',
  regret: '😕',
  
  // Neutral or mixed emotions
  surprise: '😲',
  confusion: '🤔',
  curiosity: '🧐',
  nostalgia: '🕰️',
  boredom: '😴',
  anticipation: '👀',
  awe: '😮',
  ambivalence: '😐'
};

const getRandomValue = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};

const Bubble: React.FC<BubbleProps> = ({ x, y, size, delay, children }) => {
  return (
    <motion.div
      className="absolute flex items-center justify-center"
      initial={{ x, y, opacity: 0, scale: 0 }}
      animate={{ 
        x: [x, x + getRandomValue(-2, 2)], 
        y: [y, y - getRandomValue(1, 3)],
        opacity: [0, 1, 0.8],
        scale: [0, 1, 0.9]
      }}
      transition={{
        duration: 6,
        delay,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut"
      }}
    >
      <div 
        className="rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center p-2"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        {children}
      </div>
    </motion.div>
  );
};

// Define types for our emotion/theme data
interface EmotionData {
  label: string;
  score?: number;
}

const EmotionBubbles: React.FC<EmotionBubblesProps> = ({ themes = [], emotions = {} }) => {
  const [bubbles, setBubbles] = useState<Array<{
    id: number;
    label: string;
    x: number;
    y: number;
    size: number;
    delay: number;
    emoji: string;
    score?: number;
  }>>([]);
  
  useEffect(() => {
    // We'll prioritize emotions if they exist, otherwise fall back to themes
    const usingEmotions = Object.keys(emotions).length > 0;
    
    // Create properly typed data sources
    const dataSource: EmotionData[] = usingEmotions 
      ? Object.entries(emotions).map(([key, value]) => ({ label: key, score: value }))
      : themes.map(theme => ({ label: theme }));
    
    // Limit to top emotions/themes (by score if available)
    const limitedData = usingEmotions 
      ? [...dataSource]
          .sort((a, b) => ((b.score || 0) - (a.score || 0)))
          .slice(0, 7) // Show more emotions since they're quantified
      : dataSource.slice(0, 5);
    
    // Grid layout configuration
    const gridRows = 3;
    const gridCols = 3;
    const cellWidth = 280 / gridCols;
    const cellHeight = 220 / gridRows;
    
    // Calculate positions using a grid-based approach to minimize overlap
    const newBubbles = limitedData.map((item, index) => {
      // Calculate grid position (different cells for each bubble)
      const col = index % gridCols;
      const row = Math.floor(index / gridCols) % gridRows;
      
      // Calculate base position within cell with some randomness
      const baseX = (col * cellWidth) + (cellWidth / 2) + getRandomValue(-10, 10);
      const baseY = (row * cellHeight) + (cellHeight / 2) + getRandomValue(-10, 10);
      
      // Center the grid in our container
      const x = baseX + 20; // Offset from left
      const y = baseY + 20; // Offset from top
      
      // Get the appropriate emoji based on the label
      const normalizedLabel = item.label.toLowerCase().trim();
      const emoji = EMOTION_EMOJIS[normalizedLabel] || '';
      
      // Size calculation based on score (if emotions) or position (if themes)
      let size;
      if (usingEmotions && item.score !== undefined) {
        // Scale based on score: min 40px, max 90px
        // We use a log scale to make differences more visible
        const maxScore = Math.max(...Object.values(emotions));
        const minSize = 40;
        const maxSize = 90;
        size = minSize + ((item.score / maxScore) * (maxSize - minSize));
      } else {
        // Fallback for themes (decreasing by position)
        size = 70 - (index * 5);
      }
      
      return {
        id: index,
        label: item.label,
        x,
        y,
        size: Math.max(40, Math.min(90, size)), // Ensure size is within reasonable bounds
        delay: index * 0.2, // Stagger animations
        emoji,
        score: item.score
      };
    });
    
    setBubbles(newBubbles);
  }, [themes, emotions]);
  
  return (
    <div className="relative w-full h-full border-2 border-dashed border-muted/10 rounded-lg overflow-hidden">
      {bubbles.map((bubble) => (
        <Bubble
          key={bubble.id}
          x={bubble.x}
          y={bubble.y}
          size={bubble.size}
          delay={bubble.delay}
        >
          <div className="flex flex-col items-center text-center">
            <span className="text-xs font-medium text-primary/90 max-w-[60px] line-clamp-2 capitalize">
              {bubble.label}
              {bubble.score !== undefined && (
                <span className="ml-1 text-xs text-primary/70">
                  ({Math.round(bubble.score * 10) / 10})
                </span>
              )}
            </span>
          </div>
        </Bubble>
      ))}
    </div>
  );
};

export default EmotionBubbles;
