import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

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
  containerWidth: number;
  containerHeight: number;
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

// Modified Bubble component with container awareness
const Bubble: React.FC<BubbleProps> = ({ x, y, size, delay, children, containerWidth, containerHeight }) => {
  // Calculate max offsets to keep bubbles fully inside container
  const maxOffsetX = Math.max(0, containerWidth - size - 10);
  const maxOffsetY = Math.max(0, containerHeight - size - 10);
  
  // Ensure starting position is inside container
  const safeX = Math.min(Math.max(5, x), maxOffsetX);
  const safeY = Math.min(Math.max(5, y), maxOffsetY);
  
  // Calculate small random movement that keeps bubble in boundaries
  const moveX = getRandomValue(-2, 2);
  const moveY = getRandomValue(-3, 1);
  
  // Ensure ending position stays inside container
  const endX = Math.min(Math.max(5, safeX + moveX), maxOffsetX);
  const endY = Math.min(Math.max(5, safeY + moveY), maxOffsetY);

  return (
    <motion.div
      className="absolute flex items-center justify-center"
      initial={{ x: safeX, y: safeY, opacity: 0, scale: 0 }}
      animate={{ 
        x: [safeX, endX], 
        y: [safeY, endY],
        opacity: [0, 1, 0.8],
        scale: [0, 1, 0.95]
      }}
      transition={{
        duration: 6,
        delay,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut"
      }}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <div 
        className="rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center p-2 w-full h-full"
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
  const [dimensions, setDimensions] = useState({ width: 280, height: 220 });
  const isMobile = useIsMobile();
  
  // Update container dimensions when it changes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    
    // Set initial dimensions
    updateDimensions();
    
    // Update on resize
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
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
    
    // Get container dimensions for responsive layout
    const containerWidth = dimensions.width;
    const containerHeight = dimensions.height;
    
    // Grid layout configuration - adapt to container size
    const gridRows = Math.min(3, Math.ceil(limitedData.length / 3));
    const gridCols = Math.min(3, limitedData.length);
    
    const cellWidth = containerWidth / gridCols;
    const cellHeight = containerHeight / gridRows;
    
    // Calculate positions using a grid-based approach to minimize overlap
    const newBubbles = limitedData.map((item, index) => {
      // Calculate grid position (different cells for each bubble)
      const col = index % gridCols;
      const row = Math.floor(index / gridCols) % gridRows;
      
      // Base positions with small random offsets to prevent perfect alignment
      const baseX = (col * cellWidth) + (cellWidth / 2) + getRandomValue(-5, 5);
      const baseY = (row * cellHeight) + (cellHeight / 2) + getRandomValue(-5, 5);
      
      // Get the appropriate emoji based on the label
      const normalizedLabel = item.label.toLowerCase().trim();
      const emoji = EMOTION_EMOJIS[normalizedLabel] || '';
      
      // Size calculation based on score (if emotions) or position (if themes)
      let size;
      if (usingEmotions && item.score !== undefined) {
        // Scale based on score: min size to max size
        const maxScore = Math.max(...Object.values(emotions));
        const minSize = isMobile ? 35 : 40;
        const maxSize = isMobile ? 70 : 90;
        size = minSize + ((item.score / maxScore) * (maxSize - minSize));
      } else {
        // Fallback for themes (decreasing by position)
        const baseSize = isMobile ? 60 : 70;
        size = baseSize - (index * 5);
      }
      
      // Ensure bubbles don't exceed container boundaries
      const safeSize = Math.min(
        size,
        cellWidth * 0.9,  // No more than 90% of cell width
        cellHeight * 0.9  // No more than 90% of cell height
      );
      
      return {
        id: index,
        label: item.label,
        x: baseX,
        y: baseY,
        size: Math.max(30, Math.min(90, safeSize)), // Ensure size is within reasonable bounds
        delay: index * 0.2, // Stagger animations
        emoji,
        score: item.score
      };
    });
    
    setBubbles(newBubbles);
  }, [themes, emotions, dimensions, isMobile]);
  
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
          containerWidth={dimensions.width}
          containerHeight={dimensions.height}
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
