
import React from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';

interface RecordingStatusProps {
  isRecording: boolean;
  recordingTime: string;
}

export function RecordingStatus({ isRecording, recordingTime }: RecordingStatusProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center mt-auto mb-8 relative z-10"
    >
      <div className="flex items-center gap-2 text-red-500 mb-1">
        <Mic className="w-4 h-4 animate-pulse" />
        <span className="font-medium">Recording in progress</span>
      </div>
      <p className="text-2xl font-semibold">{recordingTime}</p>
    </motion.div>
  );
}
