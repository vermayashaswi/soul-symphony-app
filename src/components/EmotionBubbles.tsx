
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
        y: [y, y - getRandomValue(5, 15)],
        opacity: [0, 1, 0.9],
        scale: [0, 1, 0.95]
      }}
      transition={{
        duration: 4,
        delay,
        repeat: Infinity,
        repeatType: "reverse"
      }}
      whileHover={{ 
        scale: 1.2, 
        zIndex: 10,
        boxShadow: "0px 5px 15px rgba(0, 0, 0, 0.1)" 
      }}
    >
      <motion.div 
        className="rounded-full bg-gradient-to-br from-primary/70 to-primary/20 flex items-center justify-center p-1 shadow-sm cursor-pointer"
        style={{ width: `${size}px`, height: `${size}px` }}
        whileTap={{ scale: 0.9 }}
      >
        {children}
      </motion.div>
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
  }>>([]);
  
  useEffect(() => {
    // Generate bubbles with a wider and more organized distribution
    const newBubbles = themes.slice(0, 10).map((theme, index) => {
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
      };
    });
    
    setBubbles(newBubbles);
  }, [themes]);
  
  return (
    <div className="relative w-full h-full overflow-visible">
      <AnimatePresence>
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
      </AnimatePresence>
    </div>
  );
};

export default EmotionBubbles;
