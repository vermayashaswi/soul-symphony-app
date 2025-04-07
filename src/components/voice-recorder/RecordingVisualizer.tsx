
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

interface RecordingVisualizerProps {
  isRecording: boolean;
  isPlaying?: boolean;
  audioLevel: number;
  ripples?: number[];
  width?: number | string;
  height?: number | string;
  barCount?: number;
  minBarHeight?: number;
  color?: string;
}

export function RecordingVisualizer({ 
  isRecording, 
  isPlaying = false,
  audioLevel, 
  ripples = [],
  width = '100%',
  height = 100,
  barCount = 40,
  minBarHeight = 5,
  color = "#4f46e5" // Indigo by default
}: RecordingVisualizerProps) {
  const { isMobile } = useIsMobile();
  const actualBarCount = isMobile ? Math.floor(barCount * 0.7) : barCount;
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const prevLevelsRef = useRef<number[]>([]);
  
  // Initialize previous levels array on mount
  useEffect(() => {
    prevLevelsRef.current = Array(actualBarCount).fill(0);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [actualBarCount]);
  
  // Generate dynamic bars based on audio level
  const generateBars = () => {
    const bars = [];
    const maxHeight = typeof height === 'number' ? height : 100;
    const scaledLevel = audioLevel / 100;
    
    // Save the current audioLevel for animation smoothing
    if (isPlaying || isRecording) {
      const levels = prevLevelsRef.current;
      
      // Smooth transition by averaging with previous values
      for (let i = 0; i < actualBarCount; i++) {
        // Create dynamic heights based on position and audio level
        const baseHeight = Math.sin((i / actualBarCount) * Math.PI) * scaledLevel * 0.8 + 0.2;
        
        // Apply random variations for more natural look
        const randomVariation = 0.2 * Math.random() * scaledLevel;
        let targetHeight = Math.max(minBarHeight / maxHeight, baseHeight + randomVariation);
        
        // Add some randomness for middle frequencies
        if (i > actualBarCount * 0.3 && i < actualBarCount * 0.7) {
          targetHeight += 0.2 * Math.random() * scaledLevel;
        }
        
        // Smooth transition (lerp) between current and target heights
        levels[i] = levels[i] * 0.7 + targetHeight * 0.3;
        
        // When playing but no level data, add oscillation effect based on time
        if (isPlaying && audioLevel <= 5) {
          const time = Date.now() / 1000;
          const oscillation = Math.sin(time * 3 + i * 0.2) * 0.1 + 0.3;
          levels[i] = levels[i] * 0.8 + oscillation * 0.2;
        }
        
        // Scale to actual pixel height
        const pixelHeight = Math.min(maxHeight, Math.max(minBarHeight, levels[i] * maxHeight));
        
        // Add animation variants
        bars.push(
          <motion.div
            key={i}
            initial={{ height: minBarHeight }}
            animate={{ 
              height: pixelHeight,
              opacity: 0.3 + (levels[i] * 0.7) // More prominent bars for louder sounds
            }}
            transition={{ 
              duration: 0.1,
              ease: "easeOut"
            }}
            className="bg-current rounded-full"
            style={{ 
              width: `${100 / (actualBarCount * 2)}%`,
              marginLeft: `${100 / (actualBarCount * 2)}%`,
            }}
          />
        );
      }
    } else {
      // Reset levels when not playing or recording
      prevLevelsRef.current = Array(actualBarCount).fill(0);
    }
    
    return bars;
  };

  return (
    <div style={{ 
      width: width, 
      height: typeof height === 'number' ? `${height}px` : height,
      overflow: 'hidden'
    }} className={`flex items-center justify-center text-${color}`}>
      {(isRecording || isPlaying) && (
        <div className="flex items-end justify-center w-full h-full">
          {generateBars()}
        </div>
      )}
      
      <AnimatePresence>
        {ripples && ripples.map((timestamp, i) => (
          <motion.div
            key={`ripple-${timestamp}`}
            initial={{ scale: 0.5, opacity: 0.7 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute rounded-full bg-current"
            style={{ 
              width: '40px', 
              height: '40px',
              zIndex: -1
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
