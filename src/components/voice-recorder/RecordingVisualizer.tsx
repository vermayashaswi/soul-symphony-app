
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
  
  // Generate dynamic bars based on audio level
  const generateBars = () => {
    const bars = [];
    const maxHeight = typeof height === 'number' ? height : 100;
    const scaledLevel = audioLevel / 100;
    
    for (let i = 0; i < actualBarCount; i++) {
      // Create dynamic heights based on position and audio level
      const baseHeight = Math.sin((i / actualBarCount) * Math.PI) * scaledLevel * 0.8 + 0.2;
      
      // Apply random variations for more natural look
      const randomVariation = 0.2 * Math.random() * scaledLevel;
      let barHeight = Math.max(minBarHeight / maxHeight, baseHeight + randomVariation);
      
      // Add some randomness for middle frequencies
      if (i > actualBarCount * 0.3 && i < actualBarCount * 0.7) {
        barHeight += 0.2 * Math.random() * scaledLevel;
      }
      
      // Scale to actual pixel height
      const pixelHeight = Math.min(maxHeight, Math.max(minBarHeight, barHeight * maxHeight));
      
      // Add animation variants
      bars.push(
        <motion.div
          key={i}
          initial={{ height: minBarHeight }}
          animate={{ 
            height: pixelHeight,
            opacity: 0.3 + (barHeight * 0.7) // More prominent bars for louder sounds
          }}
          transition={{ 
            duration: 0.15,
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
