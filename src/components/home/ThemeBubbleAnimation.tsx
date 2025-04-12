
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

const getSentimentColor = (sentiment: number): string => {
  if (sentiment >= 0.3) {
    return 'bg-[#F2FCE2] text-green-600 border-green-300'; // Positive sentiment
  } else if (sentiment >= -0.1) {
    return 'bg-[#FEF7CD] text-yellow-600 border-yellow-300'; // Neutral sentiment
  } else {
    return 'bg-red-100 text-red-600 border-red-300'; // Negative sentiment
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
  const colorClass = getSentimentColor(themeData.sentiment);
  
  useEffect(() => {
    let currentPosition = { ...initialPosition };
    let currentVelocity = { ...velocity };
    let animationFrameId: number;
    
    const updatePosition = () => {
      if (!bubbleRef.current) return;
      
      // Update position based on velocity
      currentPosition.x += currentVelocity.x;
      currentPosition.y += currentVelocity.y;
      
      // Apply the position
      controls.set({ x: currentPosition.x, y: currentPosition.y });
      
      animationFrameId = requestAnimationFrame(updatePosition);
    };
    
    updatePosition();
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [controls, initialPosition, velocity]);
  
  return (
    <motion.div
      ref={bubbleRef}
      className={`absolute flex items-center justify-center ${colorClass} border font-medium rounded-full shadow-sm`}
      initial={{ x: initialPosition.x, y: initialPosition.y }}
      animate={controls}
      whileHover={{ scale: 1.1, boxShadow: "0 0 15px rgba(var(--primary), 0.5)" }}
      transition={{ duration: 0.2 }}
      style={{ 
        width: size, 
        height: size,
      }}
    >
      <span className="px-2 text-sm text-center">{themeData.theme}</span>
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
  
  // Track current animation frame for cleanup
  const animationFrameRef = useRef<number | null>(null);
  
  // Setup container dimensions and themes
  useEffect(() => {
    if (!themesData.length) return;
    
    // Initial theme pool with duplicates to make animation more interesting
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
  
  // Bubble management (creation, movement, collision)
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0 || !themePool.length) return;
    
    const createBubble = () => {
      if (activeBubbles.length >= maxBubbles || !themePool.length) return;
      
      // Choose random theme from pool
      const themeIndex = Math.floor(Math.random() * themePool.length);
      const themeData = themePool[themeIndex];
      
      // Remove used theme from pool
      const newThemePool = [...themePool];
      newThemePool.splice(themeIndex, 1);
      setThemePool(newThemePool);
      
      // Calculate random size between 80-120px
      const size = Math.floor(Math.random() * 40) + 80;
      
      // Determine entry edge (0: top, 1: right, 2: bottom, 3: left)
      const edge = Math.floor(Math.random() * 4);
      
      // Calculate entry position and velocity
      let position: { x: number; y: number };
      let velocity: { x: number; y: number };
      
      const speedFactor = 2;
      
      switch (edge) {
        case 0: // Top edge
          position = { 
            x: Math.random() * (dimensions.width - size), 
            y: -size 
          };
          velocity = { 
            x: (Math.random() - 0.5) * speedFactor, 
            y: Math.random() * speedFactor + 1 
          };
          break;
        case 1: // Right edge
          position = { 
            x: dimensions.width, 
            y: Math.random() * (dimensions.height - size) 
          };
          velocity = { 
            x: -(Math.random() * speedFactor + 1), 
            y: (Math.random() - 0.5) * speedFactor 
          };
          break;
        case 2: // Bottom edge
          position = { 
            x: Math.random() * (dimensions.width - size), 
            y: dimensions.height 
          };
          velocity = { 
            x: (Math.random() - 0.5) * speedFactor, 
            y: -(Math.random() * speedFactor + 1) 
          };
          break;
        case 3: // Left edge
          position = { 
            x: -size, 
            y: Math.random() * (dimensions.height - size) 
          };
          velocity = { 
            x: Math.random() * speedFactor + 1, 
            y: (Math.random() - 0.5) * speedFactor 
          };
          break;
        default:
          position = { x: 0, y: 0 };
          velocity = { x: 1, y: 1 };
      }
      
      // Add bubble
      setActiveBubbles(prev => [
        ...prev, 
        { 
          id: `bubble-${Date.now()}-${Math.random()}`,
          themeData, 
          size, 
          position, 
          velocity 
        }
      ]);
    };
    
    const updateBubbles = () => {
      setActiveBubbles(bubbles => {
        // Update bubble positions
        const updatedBubbles = bubbles.map(bubble => {
          const newX = bubble.position.x + bubble.velocity.x;
          const newY = bubble.position.y + bubble.velocity.y;
          
          return {
            ...bubble,
            position: { x: newX, y: newY }
          };
        });
        
        // Check for collisions between bubbles
        for (let i = 0; i < updatedBubbles.length; i++) {
          for (let j = i + 1; j < updatedBubbles.length; j++) {
            const b1 = updatedBubbles[i];
            const b2 = updatedBubbles[j];
            
            const dx = b2.position.x - b1.position.x;
            const dy = b2.position.y - b1.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = (b1.size + b2.size) / 2;
            
            if (distance < minDistance) {
              // Calculate collision response
              const angle = Math.atan2(dy, dx);
              const sin = Math.sin(angle);
              const cos = Math.cos(angle);
              
              // Rotate velocities
              const v1 = { 
                x: b1.velocity.x * cos + b1.velocity.y * sin,
                y: b1.velocity.y * cos - b1.velocity.x * sin
              };
              const v2 = { 
                x: b2.velocity.x * cos + b2.velocity.y * sin,
                y: b2.velocity.y * cos - b2.velocity.x * sin
              };
              
              // Swap velocities
              const temp = { x: v1.x, y: v1.y };
              v1.x = v2.x;
              v2.x = temp.x;
              
              // Rotate back
              updatedBubbles[i].velocity = {
                x: v1.x * cos - v1.y * sin,
                y: v1.y * cos + v1.x * sin
              };
              updatedBubbles[j].velocity = {
                x: v2.x * cos - v2.y * sin,
                y: v2.y * cos + v2.x * sin
              };
              
              // Move bubbles apart to prevent sticking
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
        
        // Remove bubbles that are out of bounds
        return updatedBubbles.filter(bubble => {
          const outOfBounds =
            bubble.position.x < -bubble.size * 2 ||
            bubble.position.x > dimensions.width + bubble.size * 2 ||
            bubble.position.y < -bubble.size * 2 ||
            bubble.position.y > dimensions.height + bubble.size * 2;
          
          // If removing, add theme back to pool
          if (outOfBounds) {
            setThemePool(prev => [...prev, bubble.themeData]);
          }
          
          return !outOfBounds;
        });
      });
    };
    
    // Create initial bubbles
    if (activeBubbles.length < maxBubbles) {
      createBubble();
    }
    
    // Setup intervals for creating new bubbles and updating positions
    const bubbleCreationInterval = setInterval(() => {
      createBubble();
    }, 2000);
    
    const updateInterval = setInterval(() => {
      updateBubbles();
    }, 16); // ~60fps
    
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
