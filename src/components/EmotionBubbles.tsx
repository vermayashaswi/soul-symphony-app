
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Sparkles, Star, Flame, Smile } from 'lucide-react';

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

const ICONS = [
  Heart, 
  Sparkles, 
  Star, 
  Flame, 
  Smile
];

const getRandomValue = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};

const Bubble: React.FC<BubbleProps> = ({ x, y, size, delay, children }) => {
  return (
    <motion.div
      className="absolute flex items-center justify-center"
      initial={{ x, y, opacity: 0, scale: 0 }}
      animate={{ 
        x: [x, x + getRandomValue(-15, 15)], 
        y: [y, y - getRandomValue(5, 15)],
        opacity: [0, 1, 0.8],
        scale: [0, 1, 0.9]
      }}
      transition={{
        duration: 4,
        delay,
        repeat: Infinity,
        repeatType: "reverse"
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

const EmotionBubbles: React.FC<EmotionBubblesProps> = ({ themes }) => {
  const [bubbles, setBubbles] = useState<Array<{
    id: number;
    theme: string;
    x: number;
    y: number;
    size: number;
    delay: number;
    Icon: React.ElementType;
  }>>([]);
  
  useEffect(() => {
    // Generate bubbles when themes change
    const newBubbles = themes.map((theme, index) => {
      const Icon = ICONS[index % ICONS.length];
      
      return {
        id: index,
        theme,
        x: getRandomValue(20, 160),
        y: getRandomValue(20, 120),
        size: getRandomValue(50, 80),
        delay: getRandomValue(0, 1),
        Icon
      };
    });
    
    setBubbles(newBubbles);
  }, [themes]);
  
  return (
    <div className="relative w-full h-full">
      {bubbles.map((bubble) => (
        <Bubble
          key={bubble.id}
          x={bubble.x}
          y={bubble.y}
          size={bubble.size}
          delay={bubble.delay}
        >
          <div className="flex flex-col items-center text-center">
            <bubble.Icon className="h-5 w-5 text-primary mb-1" />
            <span className="text-xs font-medium text-primary/90 max-w-[60px] line-clamp-2">{bubble.theme}</span>
          </div>
        </Bubble>
      ))}
    </div>
  );
};

export default EmotionBubbles;
