
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
        x: [x, x + getRandomValue(-10, 10)], 
        y: [y, y - getRandomValue(5, 10)],
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
    // Generate bubbles with better distribution to avoid overlapping
    const newBubbles = themes.slice(0, 5).map((theme, index) => {
      const Icon = ICONS[index % ICONS.length];
      
      // Calculate positions using a more distributed approach
      // Divide the container into sections for better distribution
      const sectionWidth = 360 / Math.min(themes.length, 5);
      const sectionCenter = index * sectionWidth + (sectionWidth / 2);
      
      // Use angle-based positioning for a circular arrangement
      const angle = (sectionCenter / 180) * Math.PI;
      const radius = 80; // Smaller radius to ensure bubbles stay within container
      
      // Calculate x,y based on the angle and add some minor randomness
      const x = Math.cos(angle) * radius + 120 + getRandomValue(-10, 10); 
      const y = Math.sin(angle) * radius + 80 + getRandomValue(-10, 10);
      
      // Vary size based on index (first themes are more important)
      const size = 70 - (index * 6);
      
      return {
        id: index,
        theme,
        x,
        y,
        size,
        delay: index * 0.2, // Stagger animations
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
