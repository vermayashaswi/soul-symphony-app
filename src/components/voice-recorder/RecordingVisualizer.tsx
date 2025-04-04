
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
    <div className="relative flex items-center justify-center w-full my-8">
      <div className="relative w-full max-w-full aspect-square">
        <AnimatePresence>
          {ripples.map((id) => (
            <motion.div
              key={id}
              initial={{ scale: 0.5, opacity: 0.7 }}
              animate={{ scale: 2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="absolute inset-0 rounded-full bg-primary/30"
            />
          ))}
        </AnimatePresence>
        
        {isRecording && (
          <motion.div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
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
    </div>
  );
}
