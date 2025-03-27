
import React, { useEffect, useState, useRef } from 'react';
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
  containerRef: React.RefObject<HTMLDivElement>;
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

const Bubble: React.FC<BubbleProps> = ({ x, y, size, delay, children, containerRef }) => {
  // Calculate constraints to keep bubble fully visible
  const [constraints, setConstraints] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  
  useEffect(() => {
    if (containerRef.current) {
      // Get the container dimensions
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      
      // Set constraints to keep bubble completely within container
      setConstraints({
        top: 0,
        right: containerWidth - size,
        bottom: containerHeight - size,
        left: 0
      });
    }
  }, [containerRef, size]);

  return (
    <motion.div
      className="absolute flex items-center justify-center"
      initial={{ x, y, opacity: 0, scale: 0 }}
      animate={{ 
        x: [x, x + getRandomValue(-1, 1) * 0.5], // Reduced movement range by 75%
        y: [y, y - getRandomValue(0.5, 1.5) * 0.5], // Reduced movement range by 75%
        opacity: [0, 1, 0.9],
        scale: [0, 1, 0.95]
      }}
      transition={{
        duration: 8, // Increased from 6 to 8 for slower movement
        delay,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut", // Smoother easing function
        times: [0, 0.5, 1] // More controlled timing for smooth transitions
      }}
      drag
      dragConstraints={constraints}
      dragElastic={0.05} // Reduced from 0.1 for less elastic movement
      dragTransition={{ 
        bounceStiffness: 300, // Reduced from 600 for gentler bouncing
        bounceDamping: 30,  // Increased from 20 for quicker settling
        power: 0.5 // Added power parameter to make drag more controlled
      }}
      whileDrag={{ scale: 1.02 }} // Reduced scale effect during drag
    >
      <div 
        className="rounded-full bg-gradient-to-br from-primary/30 to-primary/10 backdrop-blur-sm flex items-center justify-center p-2"
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
  
  const containerRef = useRef<HTMLDivElement>(null);
  
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
          .slice(0, 5) // Reduced from 7 to 5 to prevent overcrowding
      : dataSource.slice(0, 5);
    
    // Wait for the container to be available and sized
    if (!containerRef.current) return;
    
    // Get container dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    // More controlled layout configuration
    const gridRows = 2; // Reduced from 3 to 2 for better spacing
    const gridCols = 3;
    const cellWidth = containerWidth / gridCols;
    const cellHeight = containerHeight / gridRows;
    
    // Calculate positions using a more stable grid-based approach
    const newBubbles = limitedData.map((item, index) => {
      // Calculate grid position (different cells for each bubble)
      const col = index % gridCols;
      const row = Math.floor(index / gridCols) % gridRows;
      
      // Calculate position within cell with minimal randomness
      const maxSize = 80; // Reduced maximum size from 90 to 80
      const safeMargin = maxSize / 2;
      
      // More stable positioning with less randomness
      const centerX = (col * cellWidth) + (cellWidth / 2);
      const centerY = (row * cellHeight) + (cellHeight / 2);
      
      // Add very slight randomness (±10% of cell size) to prevent perfect alignment
      const randomOffsetX = getRandomValue(-0.1, 0.1) * cellWidth;
      const randomOffsetY = getRandomValue(-0.1, 0.1) * cellHeight;
      
      // Final position with constraints
      const x = Math.max(safeMargin, Math.min(containerWidth - safeMargin, centerX + randomOffsetX));
      const y = Math.max(safeMargin, Math.min(containerHeight - safeMargin, centerY + randomOffsetY));
      
      // Get the appropriate emoji based on the label
      const normalizedLabel = item.label.toLowerCase().trim();
      const emoji = EMOTION_EMOJIS[normalizedLabel] || '';
      
      // Size calculation with smoother scaling
      let size;
      if (usingEmotions && item.score !== undefined) {
        // Scale based on score: min 40px, max 75px (reduced from 80)
        const maxScore = Math.max(...Object.values(emotions));
        const minSize = 40;
        const maxSize = 75;
        // More linear scaling to prevent dramatic size differences
        size = minSize + ((item.score / maxScore) * (maxSize - minSize));
      } else {
        // Fallback for themes (more consistent sizing)
        size = 60 - (index * 4); // Reduced from 70-(index*5) for more consistent sizes
      }
      
      // Ensure size is within reasonable bounds
      const cappedSize = Math.max(40, Math.min(75, size));
      
      return {
        id: index,
        label: item.label,
        x,
        y,
        size: cappedSize,
        delay: index * 0.4, // Increased from 0.2 to 0.4 for more staggered, stable animations
        emoji,
        score: item.score
      };
    });
    
    setBubbles(newBubbles);
  }, [themes, emotions, containerRef.current?.clientWidth, containerRef.current?.clientHeight]);
  
  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full border-2 border-dashed border-muted/10 rounded-lg overflow-hidden"
    >
      {bubbles.map((bubble) => (
        <Bubble
          key={bubble.id}
          x={bubble.x}
          y={bubble.y}
          size={bubble.size}
          delay={bubble.delay}
          containerRef={containerRef}
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
