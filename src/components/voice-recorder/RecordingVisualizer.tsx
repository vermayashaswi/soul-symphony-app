
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

interface RecordingVisualizerProps {
  isRecording: boolean;
  audioLevel: number;
  ripples: number[];
}

export function RecordingVisualizer({ 
  isRecording, 
  audioLevel, 
  ripples 
}: RecordingVisualizerProps) {
  // Create a simple visualization with oscillating bars
  const maxBars = 40;
  const bars = Array.from({ length: maxBars });
  
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex items-center h-16 space-x-0.5">
        {bars.map((_, i) => {
          // Calculate base height and randomize it slightly for natural look
          const baseHeight = Math.sin((i / maxBars) * Math.PI) * 100;
          const height = isRecording 
            ? Math.max(15, baseHeight * (0.3 + audioLevel * 0.7)) 
            : baseHeight;
            
          return (
            <motion.div
              key={i}
              className="w-1 bg-theme rounded-full"
              initial={{ height: 5 }}
              animate={{ 
                height: isRecording 
                  ? [height * 0.3, height, height * 0.5, height * 0.8, height * 0.4] 
                  : [baseHeight * 0.3, baseHeight * 0.7, baseHeight * 0.5]
              }}
              transition={{
                duration: isRecording ? 0.6 : 1.2,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
                delay: i * 0.02
              }}
              style={{
                opacity: isRecording ? 0.7 : 0.4
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
