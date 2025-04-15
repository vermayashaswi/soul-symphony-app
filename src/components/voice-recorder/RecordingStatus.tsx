
import React from 'react';
import { motion } from 'framer-motion';

interface RecordingStatusProps {
  isRecording: boolean;
  recordingTime: number | string;
  isProcessing?: boolean;
}

export function RecordingStatus({ isRecording, recordingTime, isProcessing = false }: RecordingStatusProps) {
  if (!isRecording && !isProcessing) return null;
  
  // Format time if it's a number (milliseconds)
  const displayTime = typeof recordingTime === 'number' 
    ? formatTime(recordingTime)
    : recordingTime;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-2 mt-4"
      data-testid="recording-status"
    >
      <motion.div 
        className="w-4 h-4 rounded-full bg-red-500"
        animate={{ 
          opacity: isRecording ? [1, 0.4, 1] : 1,
          scale: isRecording ? [1, 1.1, 1] : 1
        }}
        transition={{ 
          repeat: isRecording ? Infinity : 0, 
          duration: 1.2,
          ease: "easeInOut"
        }}
      />
      <span className="text-xl font-medium">{displayTime}</span>
      {isProcessing && <span className="text-sm text-gray-500 ml-2">(Processing...)</span>}
    </motion.div>
  );
}

// Helper function to format time in mm:ss format
function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(seconds).padStart(2, "0");

  return `${formattedMinutes}:${formattedSeconds}`;
}
