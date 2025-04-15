
import React from 'react';
import { motion } from 'framer-motion';
import { formatTime } from '@/utils/format-time';

interface RecordingStatusProps {
  isRecording: boolean;
  recordingTime: number | string;
}

export function RecordingStatus({ isRecording, recordingTime }: RecordingStatusProps) {
  // If recordingTime is already a string, use it directly, otherwise format it
  const displayTime = typeof recordingTime === 'string' 
    ? recordingTime 
    : formatTime(typeof recordingTime === 'number' ? recordingTime / 1000 : 0);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-2 mt-4"
    >
      <motion.div 
        className="w-4 h-4 rounded-full bg-red-500"
        animate={{ 
          opacity: [1, 0.4, 1],
          scale: [1, 1.1, 1]
        }}
        transition={{ 
          repeat: Infinity, 
          duration: 1.2,
          ease: "easeInOut"
        }}
      />
      <span className="text-xl font-medium">{displayTime}</span>
    </motion.div>
  );
}
