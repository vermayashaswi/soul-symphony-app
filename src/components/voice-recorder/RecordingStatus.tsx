
import React from 'react';
import { motion } from 'framer-motion';
import { formatTime } from '@/utils/format-time';

interface RecordingStatusProps {
  isRecording: boolean;
  recordingTime: number;
}

export function RecordingStatus({ isRecording, recordingTime }: RecordingStatusProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-2 mt-6"
    >
      <motion.div 
        className="w-5 h-5 rounded-full bg-red-500"
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
      <span className="text-2xl font-medium">{formatTime(recordingTime)}</span>
    </motion.div>
  );
}
