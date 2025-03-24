
import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecordingButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  hasPermission: boolean | null;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  onPermissionRequest: () => void;
}

export function RecordingButton({
  isRecording,
  isProcessing,
  hasPermission,
  onRecordingStart,
  onRecordingStop,
  onPermissionRequest
}: RecordingButtonProps) {
  if (hasPermission === false) {
    return (
      <motion.button
        onClick={onPermissionRequest}
        className="relative z-10 rounded-full flex items-center justify-center border transition-all duration-300 shadow-lg bg-red-500 border-red-600 w-20 h-20"
        whileTap={{ scale: 0.95 }}
      >
        <Mic className="w-8 h-8 text-white" />
      </motion.button>
    );
  }
  
  return (
    <motion.button
      onClick={isRecording ? onRecordingStop : onRecordingStart}
      disabled={isProcessing}
      className={cn(
        "relative z-10 rounded-full flex items-center justify-center border transition-all duration-300 shadow-lg",
        isRecording 
          ? "bg-red-500 border-red-600 w-16 h-16" 
          : "bg-primary hover:bg-primary/90 border-primary/20 w-20 h-20",
        isProcessing && "opacity-50 cursor-not-allowed"
      )}
      whileTap={{ scale: 0.95 }}
      animate={isRecording ? { scale: [1, 1.05, 1], transition: { repeat: Infinity, duration: 1.5 } } : {}}
    >
      {isRecording ? (
        <Square className="w-6 h-6 text-white" />
      ) : (
        <Mic className="w-8 h-8 text-white" />
      )}
    </motion.button>
  );
}
