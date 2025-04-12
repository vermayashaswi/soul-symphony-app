import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface ThemeData {
  theme: string;
  sentiment: number;
}

interface ThemeBubbleProps {
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
      className="absolute flex items-center justify-center rounded-full cursor-pointer"
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

interface ThemeBubbleAnimationProps {
  themesData: ThemeData[];
  maxBubbles?: number;
}

const ThemeBubbleAnimation: React.FC<ThemeBubbleAnimationProps> = ({ 
  themesData, 
  maxBubbles = 5
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [activeBubbles, setActiveBubbles] = useState<Array<{
    id: string;
    themeData: ThemeData;
    size: number;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
  }>>([]);
  const [themePool, setThemePool] = useState<ThemeData[]>([]);
  
  const animationFrameRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!themesData.length) return;
    
    setThemePool([...themesData, ...themesData].sort(() => Math.random() - 0.5));
    
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, [themesData]);
  
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0 || !themePool.length) return;
    
    const createBubble = () => {
      if (activeBubbles.length >= maxBubbles || !themePool.length) return;
      
      const themeIndex = Math.floor(Math.random() * themePool.length);
      const themeData = themePool[themeIndex];
      
      const newThemePool = [...themePool];
      newThemePool.splice(themeIndex, 1);
      setThemePool(newThemePool);
      
      const MIN_SIZE = 50;
      const MAX_SIZE = 75;
      
      const textLength = themeData.theme.length;
      let bubbleSize = MIN_SIZE;
      
      if (textLength > 10) {
        bubbleSize = Math.min(MAX_SIZE, MIN_SIZE + textLength * 1.5);
      } else if (textLength > 6) {
        bubbleSize = Math.min(MAX_SIZE, MIN_SIZE + textLength);
      } else if (textLength > 3) {
        bubbleSize = Math.min(MAX_SIZE, MIN_SIZE + textLength * 0.8);
      }
      
      const edge = Math.floor(Math.random() * 4);
      
      let position: { x: number; y: number };
      let velocity: { x: number; y: number };
      
      const speedFactor = 0.5;
      
      switch (edge) {
        case 0:
          position = { 
            x: Math.random() * (dimensions.width - bubbleSize), 
            y: -bubbleSize 
          };
          velocity = { 
            x: (Math.random() - 0.5) * speedFactor, 
            y: Math.random() * speedFactor + 0.25 
          };
          break;
        case 1:
          position = { 
            x: dimensions.width, 
            y: Math.random() * (dimensions.height - bubbleSize) 
          };
          velocity = { 
            x: -(Math.random() * speedFactor + 0.25), 
            y: (Math.random() - 0.5) * speedFactor 
          };
          break;
        case 2:
          position = { 
            x: Math.random() * (dimensions.width - bubbleSize), 
            y: dimensions.height 
          };
          velocity = { 
            x: (Math.random() - 0.5) * speedFactor, 
            y: -(Math.random() * speedFactor + 0.25) 
          };
          break;
        case 3:
          position = { 
            x: -bubbleSize, 
            y: Math.random() * (dimensions.height - bubbleSize) 
          };
          velocity = { 
            x: Math.random() * speedFactor + 0.25, 
            y: (Math.random() - 0.5) * speedFactor 
          };
          break;
        default:
          position = { x: 0, y: 0 };
          velocity = { x: 0.25, y: 0.25 };
      }
      
      setActiveBubbles(prev => [
        ...prev, 
        { 
          id: `bubble-${Date.now()}-${Math.random()}`,
          themeData, 
          size: bubbleSize, 
          position, 
          velocity 
        }
      ]);
    };
    
    const updateBubbles = () => {
      setActiveBubbles(bubbles => {
        const updatedBubbles = bubbles.map(bubble => {
          const newX = bubble.position.x + bubble.velocity.x;
          const newY = bubble.position.y + bubble.velocity.y;
          
          return {
            ...bubble,
            position: { x: newX, y: newY }
          };
        });
        
        for (let i = 0; i < updatedBubbles.length; i++) {
          for (let j = i + 1; j < updatedBubbles.length; j++) {
            const b1 = updatedBubbles[i];
            const b2 = updatedBubbles[j];
            
            const dx = b2.position.x - b1.position.x;
            const dy = b2.position.y - b1.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = (b1.size + b2.size) / 2;
            
            if (distance < minDistance) {
              const angle = Math.atan2(dy, dx);
              const sin = Math.sin(angle);
              const cos = Math.cos(angle);
              
              const v1 = { 
                x: b1.velocity.x * cos + b1.velocity.y * sin,
                y: b1.velocity.y * cos - b1.velocity.x * sin
              };
              const v2 = { 
                x: b2.velocity.x * cos + b2.velocity.y * sin,
                y: b2.velocity.y * cos - b2.velocity.x * sin
              };
              
              const temp = { x: v1.x, y: v1.y };
              v1.x = v2.x;
              v2.x = temp.x;
              
              updatedBubbles[i].velocity = {
                x: v1.x * cos - v1.y * sin,
                y: v1.y * cos + v1.x * sin
              };
              updatedBubbles[j].velocity = {
                x: v2.x * cos - v2.y * sin,
                y: v2.y * cos + v2.x * sin
              };
              
              const overlap = minDistance - distance;
              const moveX = overlap * Math.cos(angle) / 2;
              const moveY = overlap * Math.sin(angle) / 2;
              
              updatedBubbles[i].position.x -= moveX;
              updatedBubbles[i].position.y -= moveY;
              updatedBubbles[j].position.x += moveX;
              updatedBubbles[j].position.y += moveY;
            }
          }
        }
        
        return updatedBubbles.filter(bubble => {
          const outOfBounds =
            bubble.position.x < -bubble.size * 2 ||
            bubble.position.x > dimensions.width + bubble.size * 2 ||
            bubble.position.y < -bubble.size * 2 ||
            bubble.position.y > dimensions.height + bubble.size * 2;
          
          if (outOfBounds) {
            setThemePool(prev => [...prev, bubble.themeData]);
          }
          
          return !outOfBounds;
        });
      });
    };
    
    const bubbleCreationInterval = setInterval(() => {
      createBubble();
    }, 2000);
    
    const updateInterval = setInterval(() => {
      updateBubbles();
    }, 16);
    
    return () => {
      clearInterval(bubbleCreationInterval);
      clearInterval(updateInterval);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dimensions, themePool, activeBubbles, maxBubbles]);
  
  const handleCollision = (id: string, newVelocity: { x: number; y: number }) => {
    setActiveBubbles(bubbles => 
      bubbles.map(bubble => 
        bubble.id === id 
          ? { ...bubble, velocity: newVelocity } 
          : bubble
      )
    );
  };
  
  if (!themesData.length) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>No themes found in your recent journal entries</p>
      </div>
    );
  }
  
  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      {activeBubbles.map(bubble => (
        <ThemeBubble
          key={bubble.id}
          id={bubble.id}
          themeData={bubble.themeData}
          size={bubble.size}
          initialPosition={bubble.position}
          velocity={bubble.velocity}
          onCollision={handleCollision}
        />
      ))}
    </div>
  );
};

export default ThemeBubbleAnimation;
