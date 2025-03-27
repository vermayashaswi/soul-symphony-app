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
      drag
      dragConstraints={constraints}
      dragElastic={0.1}
      dragTransition={{ 
        bounceStiffness: 600, 
        bounceDamping: 20 
      }}
      whileDrag={{ scale: 1.05 }}
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
          .slice(0, 7) // Show more emotions since they're quantified
      : dataSource.slice(0, 5);
    
    // Wait for the container to be available and sized
    if (!containerRef.current) return;
    
    // Get container dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    // Grid layout configuration - adjust based on container size
    const gridRows = 3;
    const gridCols = 3;
    const cellWidth = containerWidth / gridCols;
    const cellHeight = containerHeight / gridRows;
    
    // Calculate positions using a grid-based approach to minimize overlap
    const newBubbles = limitedData.map((item, index) => {
      // Calculate grid position (different cells for each bubble)
      const col = index % gridCols;
      const row = Math.floor(index / gridCols) % gridRows;
      
      // Calculate base position within cell with some randomness
      // Ensure we leave enough margin for the bubble size
      const maxSize = 90; // Maximum bubble size
      const safeMargin = maxSize / 2; // Safe margin to prevent overflow
      
      // Position bubbles with safe margins from the edges
      const baseX = (col * cellWidth) + (cellWidth / 2);
      const baseY = (row * cellHeight) + (cellHeight / 2);
      
      // Ensure x and y are within proper bounds
      const x = Math.max(safeMargin, Math.min(containerWidth - safeMargin, baseX));
      const y = Math.max(safeMargin, Math.min(containerHeight - safeMargin, baseY));
      
      // Get the appropriate emoji based on the label
      const normalizedLabel = item.label.toLowerCase().trim();
      const emoji = EMOTION_EMOJIS[normalizedLabel] || '';
      
      // Size calculation based on score (if emotions) or position (if themes)
      let size;
      if (usingEmotions && item.score !== undefined) {
        // Scale based on score: min 40px, max 80px
        // We use a log scale to make differences more visible
        const maxScore = Math.max(...Object.values(emotions));
        const minSize = 40;
        const maxSize = 80;
        size = minSize + ((item.score / maxScore) * (maxSize - minSize));
      } else {
        // Fallback for themes (decreasing by position)
        size = 70 - (index * 5);
      }
      
      // Ensure size is within reasonable bounds and not too large for container
      const cappedSize = Math.max(40, Math.min(80, size));
      
      return {
        id: index,
        label: item.label,
        x,
        y,
        size: cappedSize,
        delay: index * 0.2, // Stagger animations
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
