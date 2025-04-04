
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
        className="relative z-10 rounded-full flex items-center justify-center border transition-all duration-300 shadow-lg bg-red-500 border-red-600 w-36 h-36"
        whileTap={{ scale: 0.95 }}
      >
        <Mic className="w-12 h-12 text-white" />
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
          ? "bg-red-500 border-red-600 w-36 h-36" 
          : isProcessing 
            ? "bg-gray-400 border-gray-500 w-36 h-36 opacity-50 cursor-not-allowed" 
            : "bg-primary hover:bg-primary/90 border-primary/20 w-36 h-36",
      )}
      whileTap={{ scale: 0.95 }}
      animate={isRecording ? 
        { 
          scale: [1, 1.1, 1], 
          transition: { 
            repeat: Infinity, 
            duration: 1.2,
            ease: "easeInOut"
          } 
        } : {}
      }
    >
      {isRecording ? (
        <Square className="w-10 h-10 text-white" />
      ) : (
        <Mic className="w-12 h-12 text-white" />
      )}
    </motion.button>
  );
}
