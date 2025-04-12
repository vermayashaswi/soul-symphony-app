
import React, { useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

export interface ThemeData {
  theme: string;
  sentiment: number;
}

export interface ThemeBubbleProps {
  themeData: ThemeData;
  size: number;
  initialPosition: { x: number; y: number };
  velocity: { x: number; y: number };
  onCollision: (id: string, newVelocity: { x: number; y: number }) => void;
  id: string;
}

const getSentimentGradient = (sentiment: number) => {
  const normalizedSentiment = (sentiment + 1) / 2;
  
  if (normalizedSentiment < 0.4) {
    return `radial-gradient(circle at 30% 30%, 
      rgba(255, 255, 255, 0.9) 5%, 
      rgba(222, 184, 207, 0.7) 20%, 
      rgba(200, 160, 190, 0.5) 60%, 
      rgba(180, 140, 170, 0.2) 100%)`;
  } else if (normalizedSentiment < 0.6) {
    return `radial-gradient(circle at 30% 30%, 
      rgba(255, 255, 255, 0.9) 5%, 
      rgba(173, 216, 230, 0.7) 20%, 
      rgba(173, 216, 230, 0.5) 60%, 
      rgba(173, 216, 230, 0.2) 100%)`;
  } else {
    return `radial-gradient(circle at 30% 30%, 
      rgba(255, 255, 255, 0.9) 5%, 
      rgba(173, 230, 203, 0.7) 20%, 
      rgba(173, 230, 203, 0.5) 60%, 
      rgba(173, 230, 203, 0.2) 100%)`;
  }
};

const getSentimentGlow = (sentiment: number) => {
  const normalizedSentiment = (sentiment + 1) / 2;
  
  if (normalizedSentiment < 0.4) {
    return 'rgba(180, 100, 140, 0.3)';
  } else if (normalizedSentiment < 0.6) {
    return 'rgba(70, 130, 180, 0.3)';
  } else {
    return 'rgba(70, 180, 140, 0.3)';
  }
};

const ThemeBubble: React.FC<ThemeBubbleProps> = ({ 
  themeData, 
  size, 
  initialPosition, 
  velocity, 
  onCollision,
  id 
}) => {
  const controls = useAnimation();
  const bubbleRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    let currentPosition = { ...initialPosition };
    let currentVelocity = { ...velocity };
    let animationFrameId: number;
    
    const updatePosition = () => {
      if (!bubbleRef.current) return;
      
      currentPosition.x += currentVelocity.x;
      currentPosition.y += currentVelocity.y;
      
      controls.set({ x: currentPosition.x, y: currentPosition.y });
      
      animationFrameId = requestAnimationFrame(updatePosition);
    };
    
    updatePosition();
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [controls, initialPosition, velocity]);

  const calculateFontSize = () => {
    const textLength = themeData.theme.length;
    
    if (textLength <= 3) return '16px';
    if (textLength <= 6) return '14px';
    if (textLength <= 10) return '12px';
    return '10px';
  };
  
  const bubbleGradient = getSentimentGradient(themeData.sentiment);
  const bubbleGlow = getSentimentGlow(themeData.sentiment);
  
  return (
    <motion.div
      ref={bubbleRef}
      className="absolute flex items-center justify-center rounded-full cursor-pointer z-10"
      initial={{ x: initialPosition.x, y: initialPosition.y }}
      animate={controls}
      whileHover={{ scale: 1.1 }}
      transition={{ duration: 0.2 }}
      style={{ 
        width: size, 
        height: size,
        background: bubbleGradient,
        boxShadow: `0 0 12px 6px rgba(255, 255, 255, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.7), 0 0 12px ${bubbleGlow}`,
        backdropFilter: 'blur(3px)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
      }}
    >
      <span 
        className="text-center overflow-hidden px-2"
        style={{ 
          fontSize: calculateFontSize(),
          fontWeight: 500,
          color: 'rgba(0, 0, 0, 0.7)',
          textShadow: '0 1px 2px rgba(255, 255, 255, 0.6)',
          maxWidth: '90%',
          maxHeight: '90%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1.1,
          wordBreak: 'break-word',
        }}
      >
        {themeData.theme}
      </span>
    </motion.div>
  );
};

export default ThemeBubble;
