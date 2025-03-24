
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface EmotionBubblesProps {
  themes: string[];
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
        x: [x, x + getRandomValue(-5, 5)], 
        y: [y, y - getRandomValue(3, 7)],
        opacity: [0, 1, 0.9],
        scale: [0, 1, 0.95]
      }}
      transition={{
        duration: 4,
        delay,
        repeat: Infinity,
        repeatType: "reverse"
      }}
    >
      <div 
        className="rounded-full bg-gradient-to-br from-primary/70 to-primary/20 flex items-center justify-center p-1 shadow-sm"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        {children}
      </div>
    </motion.div>
  );
};

const EmotionBubbles: React.FC<EmotionBubblesProps> = ({ themes }) => {
  const [bubbles, setBubbles] = useState<Array<{
    id: number;
    theme: string;
    x: number;
    y: number;
    size: number;
    delay: number;
    emoji: string;
  }>>([]);
  
  useEffect(() => {
    // Generate bubbles with a wider and more organized distribution
    const newBubbles = themes.slice(0, 10).map((theme, index) => {
      // Get the appropriate emoji based on the theme
      const normalizedTheme = theme.toLowerCase().trim();
      const emoji = EMOTION_EMOJIS[normalizedTheme] || '';
      
      // Use a circular arrangement with full 360 degree coverage
      // This gives better separation between bubbles
      const angle = (index / Math.min(themes.length, 10)) * 2 * Math.PI;
      
      // Use variable radius based on index to create layered effect
      // Inner and outer rings to maximize space usage
      const isOuterRing = index % 2 === 0;
      const radius = isOuterRing ? 140 : 80;  // Larger radius for better spread
      
      // Calculate x,y based on the angle with container center as origin
      const containerWidth = 400;  // Increase container width
      const containerHeight = 300; // Use more vertical space
      const centerX = containerWidth / 2;
      const centerY = containerHeight / 2;
      
      const x = Math.cos(angle) * radius + centerX; 
      const y = Math.sin(angle) * radius + centerY;
      
      // Randomize size less dramatically (bigger bubbles overall)
      const baseSize = 65;
      const variableSize = 15;
      const size = baseSize - (index * (variableSize / themes.length));
      
      return {
        id: index,
        theme,
        x,
        y,
        size: Math.max(size, 40), // Ensure minimum bubble size
        delay: index * 0.1, // Quicker appearance for all bubbles
        emoji
      };
    });
    
    setBubbles(newBubbles);
  }, [themes]);
  
  return (
    <div className="relative w-full h-full overflow-visible">
      {bubbles.map((bubble) => (
        <Bubble
          key={bubble.id}
          x={bubble.x}
          y={bubble.y}
          size={bubble.size}
          delay={bubble.delay}
        >
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-sm font-semibold text-primary-foreground">{bubble.theme}</span>
          </div>
        </Bubble>
      ))}
    </div>
  );
};

export default EmotionBubbles;
