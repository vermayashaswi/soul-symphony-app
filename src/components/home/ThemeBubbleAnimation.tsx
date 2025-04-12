
import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useTheme } from '@/hooks/use-theme';

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
  themeColor: string;
  delay: number;
}

const ThemeBubble: React.FC<ThemeBubbleProps> = ({ 
  themeData, 
  size, 
  initialPosition, 
  velocity, 
  onCollision,
  id,
  themeColor,
  delay
}) => {
  const controls = useAnimation();
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const positionRef = useRef({ ...initialPosition });
  const velocityRef = useRef({ ...velocity });
  
  useEffect(() => {
    let animationFrameId: number;
    
    // Delayed animation start for staggered effect
    const startDelay = setTimeout(() => {
      setIsAnimating(false);
      
      const updatePosition = () => {
        if (!bubbleRef.current) return;
        
        // Update position based on velocity
        positionRef.current.x += velocityRef.current.x;
        positionRef.current.y += velocityRef.current.y;
        
        // Apply the position
        controls.set({ x: positionRef.current.x, y: positionRef.current.y });
        
        // Continue the animation loop
        animationFrameId = requestAnimationFrame(updatePosition);
      };
      
      // Start the animation loop
      animationFrameId = requestAnimationFrame(updatePosition);
    }, delay);
    
    return () => {
      clearTimeout(startDelay);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [controls, initialPosition, velocity, delay]);

  // Calculate font size based on text length and bubble size
  const calculateFontSize = () => {
    const textLength = themeData.theme.length;
    
    if (textLength <= 3) return '16px';
    if (textLength <= 6) return '14px';
    if (textLength <= 10) return '12px';
    return '10px';
  };

  // Create a background with gradient based on theme color
  const createBubbleBackground = () => {
    return `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9) 5%, ${themeColor}40 20%, ${themeColor}30 60%, ${themeColor}10 100%)`;
  };
  
  // Create shadow with theme color
  const createBubbleShadow = () => {
    return `0 0 12px 6px rgba(255, 255, 255, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.7), 0 0 12px ${themeColor}30`;
  };
  
  return (
    <motion.div
      ref={bubbleRef}
      className="absolute flex items-center justify-center rounded-full cursor-pointer"
      initial={{ 
        x: initialPosition.x, 
        y: initialPosition.y,
        scale: 0,
        opacity: 0 
      }}
      animate={isAnimating ? {
        scale: 1,
        opacity: 1,
        transition: {
          duration: 0.8, // Slower animation
          ease: "easeOut"
        }
      } : controls}
      whileHover={{ scale: 1.1 }}
      transition={{ duration: 0.2 }}
      style={{ 
        width: size, 
        height: size,
        background: createBubbleBackground(),
        boxShadow: createBubbleShadow(),
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
    delay: number;
    distanceFromCenter: number; // Add distance tracking
  }>>([]);
  const [themePool, setThemePool] = useState<ThemeData[]>([]);
  const { colorTheme, customColor } = useTheme();
  const popCenterRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const bubbleGenerationInProgress = useRef<boolean>(false);
  
  // Get the theme color based on the current theme
  const getThemeColorHex = (): string => {
    switch (colorTheme) {
      case 'Default':
        return '#3b82f6';
      case 'Calm':
        return '#8b5cf6';
      case 'Soothing':
        return '#FFDEE2';
      case 'Energy':
        return '#f59e0b';
      case 'Focus':
        return '#10b981';
      case 'Custom':
        return customColor;
      default:
        return '#3b82f6';
    }
  };
  
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
  
  // Calculate distance between two points
  const calculateDistance = (p1: {x: number, y: number}, p2: {x: number, y: number}): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };
  
  // Check if a new bubble would collide with existing bubbles
  const wouldCollideAtPopPoint = (newBubbleSize: number): boolean => {
    const popCenter = popCenterRef.current;
    const newBubbleRadius = newBubbleSize / 2;
    const collisionThreshold = 5; // 5px space around pop point
    
    for (const bubble of activeBubbles) {
      const bubbleCenter = {
        x: bubble.position.x + bubble.size / 2,
        y: bubble.position.y + bubble.size / 2
      };
      
      const distance = calculateDistance(popCenter, bubbleCenter);
      const minSafeDistance = newBubbleRadius + bubble.size / 2 + collisionThreshold;
      
      if (distance < minSafeDistance) {
        return true;
      }
    }
    
    return false;
  };
  
  // Function to create a new bubble
  const createBubble = () => {
    if (activeBubbles.length >= maxBubbles || !themePool.length || bubbleGenerationInProgress.current) return;
    
    bubbleGenerationInProgress.current = true;
    
    // Choose random theme from pool
    const themeIndex = Math.floor(Math.random() * themePool.length);
    const themeData = themePool[themeIndex];
    
    // Remove used theme from pool
    const newThemePool = [...themePool];
    newThemePool.splice(themeIndex, 1);
    setThemePool(newThemePool);
    
    // Basic bubble size and text length-based sizing
    const MIN_SIZE = 50; // Current baseline size
    const MAX_SIZE = 75; // 1.5x increase from baseline
    
    // Calculate size based on text length to avoid text wrapping
    const textLength = themeData.theme.length;
    let bubbleSize = MIN_SIZE;
    
    // Adjust size based on text length
    if (textLength > 10) {
      bubbleSize = Math.min(MAX_SIZE, MIN_SIZE + textLength * 1.5);
    } else if (textLength > 6) {
      bubbleSize = Math.min(MAX_SIZE, MIN_SIZE + textLength);
    } else if (textLength > 3) {
      bubbleSize = Math.min(MAX_SIZE, MIN_SIZE + textLength * 0.8);
    }
    
    // Check for collision at pop point
    if (wouldCollideAtPopPoint(bubbleSize)) {
      // Try again later
      bubbleGenerationInProgress.current = false;
      return;
    }
    
    // Position at the pop center
    const position = { 
      x: popCenterRef.current.x - bubbleSize / 2, 
      y: popCenterRef.current.y - bubbleSize / 2
    };
    
    // Generate random direction for velocity
    const angle = Math.random() * Math.PI * 2; // Random angle in radians
    const speedFactor = 0.5;
    const speed = (Math.random() * 0.5 + 0.25) * speedFactor;
    
    const velocity = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    };
    
    const delay = 100; // Small delay for animation
    
    // Add bubble with animation from center
    setActiveBubbles(prev => [
      ...prev, 
      { 
        id: `bubble-${Date.now()}-${Math.random()}`,
        themeData, 
        size: bubbleSize, 
        position, 
        velocity,
        delay,
        distanceFromCenter: 0 
      }
    ]);
    
    // Reset flag after a short delay to allow animation to start
    setTimeout(() => {
      bubbleGenerationInProgress.current = false;
    }, 100);
  };
  
  // Check if any bubble has moved far enough from center to trigger next bubble
  const checkDistancesAndCreateBubble = () => {
    if (bubbleGenerationInProgress.current || activeBubbles.length >= maxBubbles) return;
    
    if (activeBubbles.length === 0) {
      // Create first bubble if none exist
      createBubble();
      return;
    }
    
    // Check if any bubble is at least 15px away from center
    const popCenter = popCenterRef.current;
    const hasMovedEnough = activeBubbles.some(bubble => {
      const bubbleCenter = {
        x: bubble.position.x + bubble.size / 2,
        y: bubble.position.y + bubble.size / 2
      };
      return calculateDistance(popCenter, bubbleCenter) > 15;
    });
    
    if (hasMovedEnough && !wouldCollideAtPopPoint(50)) { // Using 50 as a default size estimate
      createBubble();
    }
  };
  
  // Bubble management (creation, movement, collision)
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0 || !themePool.length) return;
    
    // Set the popping center location (moved up by 17px from center)
    const centerX = dimensions.width / 2; 
    const centerY = dimensions.height / 2 - 17; // Moved up by 17px total
    popCenterRef.current = { x: centerX, y: centerY };
    
    const updateBubbles = () => {
      setActiveBubbles(bubbles => {
        // Update bubble positions based on their velocity
        const updatedBubbles = bubbles.map(bubble => {
          const newX = bubble.position.x + bubble.velocity.x;
          const newY = bubble.position.y + bubble.velocity.y;
          
          // Calculate new distance from center
          const bubbleCenterX = newX + bubble.size / 2;
          const bubbleCenterY = newY + bubble.size / 2;
          const distanceFromCenter = calculateDistance(
            popCenterRef.current,
            { x: bubbleCenterX, y: bubbleCenterY }
          );
          
          return {
            ...bubble,
            position: { x: newX, y: newY },
            distanceFromCenter
          };
        });
        
        // Check for collisions between bubbles
        for (let i = 0; i < updatedBubbles.length; i++) {
          for (let j = i + 1; j < updatedBubbles.length; j++) {
            const b1 = updatedBubbles[i];
            const b2 = updatedBubbles[j];
            
            const dx = (b2.position.x + b2.size/2) - (b1.position.x + b1.size/2);
            const dy = (b2.position.y + b2.size/2) - (b1.position.y + b1.size/2);
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
      
      // Check if we should create a new bubble based on existing bubble distances
      checkDistancesAndCreateBubble();
    };
    
    // Create initial bubble if none exist
    if (activeBubbles.length === 0 && !bubbleGenerationInProgress.current) {
      createBubble();
    }
    
    // Setup interval for updating positions and checking for new bubbles
    const updateInterval = setInterval(() => {
      updateBubbles();
    }, 16); // ~60fps
    
    return () => {
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
  
  const themeColor = getThemeColorHex();
  
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
          themeColor={themeColor}
          delay={bubble.delay}
        />
      ))}
    </div>
  );
};

export default ThemeBubbleAnimation;
