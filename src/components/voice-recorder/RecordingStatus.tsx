
import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { formatTime } from '@/utils/format-time';

interface RecordingStatusProps {
  isRecording: boolean;
  recordingTime: number;
}

export function RecordingStatus({ isRecording, recordingTime }: RecordingStatusProps) {
  if (!isRecording) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="text-center"
    >
      <div className="flex items-center gap-2 text-red-500 font-medium">
        <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span>Recording</span>
      </div>
      <p className="text-lg font-mono mt-1">{formatTime(recordingTime)}</p>
      <p className="text-xs text-muted-foreground mt-1">
        <AlertCircle className="h-3 w-3 inline-block mr-1" />
        Speak clearly for best results
      </p>
    </motion.div>
  );
}
