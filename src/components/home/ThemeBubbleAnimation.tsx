
import React, { useEffect, useRef, useState } from 'react';
import ThemeBubble, { ThemeData } from './ThemeBubble';
import { createBubble, updateBubblePositions } from './bubbleUtils';

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
  
  // Initialize dimensions and theme pool
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
  
  // Handle bubble creation and updates
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0 || !themePool.length) return;
    
    const createBubbleInterval = setInterval(() => {
      const { newBubble, updatedThemePool } = createBubble(
        themePool,
        activeBubbles,
        dimensions,
        maxBubbles
      );
      
      if (newBubble) {
        setThemePool(updatedThemePool);
        setActiveBubbles(prev => [...prev, newBubble]);
      }
    }, 2000);
    
    const updateInterval = setInterval(() => {
      const { updatedBubbles, outOfBoundsBubbleThemes } = updateBubblePositions(
        activeBubbles,
        dimensions
      );
      
      setActiveBubbles(updatedBubbles);
      
      if (outOfBoundsBubbleThemes.length > 0) {
        setThemePool(prev => [...prev, ...outOfBoundsBubbleThemes]);
      }
    }, 16);
    
    return () => {
      clearInterval(createBubbleInterval);
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
