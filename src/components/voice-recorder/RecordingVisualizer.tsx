
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  return (
    <div className="relative flex items-center justify-center my-8 w-full max-w-md mx-auto">
      <AnimatePresence>
        {ripples.map((id) => (
          <motion.div
            key={id}
            initial={{ scale: 0.5, opacity: 0.7 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute rounded-full bg-primary/30 w-full"
            style={{ width: '100%', height: '100%' }}
          />
        ))}
      </AnimatePresence>
      
      {isRecording && (
        <motion.div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="h-full w-full rounded-full border-4 border-transparent relative">
            <div className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(rgba(147, 51, 234, ${Math.min(0.8, audioLevel / 100 + 0.1)}) ${audioLevel}%, transparent ${audioLevel}%)`,
                transform: 'rotate(-90deg)',
                transition: 'all 0.2s ease'
              }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
