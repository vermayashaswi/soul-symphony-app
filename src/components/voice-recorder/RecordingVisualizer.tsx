
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
  // Only render if recording and we have audio input
  if (!isRecording) return null;
  
  return (
    <div className="relative flex items-center justify-center w-full my-4">
      <AnimatePresence>
        {ripples.map((id) => (
          <motion.div
            key={id}
            initial={{ scale: 0.5, opacity: 0.7 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-red-500/30"
            style={{
              width: '150px',
              height: '150px',
              margin: 'auto',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
