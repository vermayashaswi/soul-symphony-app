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
  audioLevel?: number;
  showAnimation?: boolean;
}

export function RecordingButton({
  isRecording,
  isProcessing,
  hasPermission,
  onRecordingStart,
  onRecordingStop,
  onPermissionRequest,
  audioLevel = 0,
  showAnimation = true
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
  
  // Dynamic glow effect based on audio level - keep this prominent
  const glowSize = isRecording ? Math.max(12, Math.min(60, audioLevel / 5 * 3)) : 0;
  
  // Get button color based on state
  const getButtonColor = () => {
    if (isProcessing) return "bg-gray-400 border-gray-500";
    if (!isRecording) return "bg-theme-color hover:bg-theme-color/90 border-theme-color/20";
    return "bg-red-500 border-red-600";
  };
  
  return (
    <div className="relative flex items-center justify-center">
      <motion.button
        onClick={isRecording ? onRecordingStop : onRecordingStart}
        disabled={isProcessing}
        className={cn(
          "relative z-10 rounded-full flex items-center justify-center border transition-all duration-300 shadow-lg",
          getButtonColor(),
          isRecording ? "w-20 h-20" : isProcessing ? "w-20 h-20 opacity-50 cursor-not-allowed" : "w-20 h-20",
        )}
        style={{
          boxShadow: isRecording ? `0 0 ${glowSize}px ${glowSize/2}px rgba(239, 68, 68, 0.8)` : undefined
        }}
        whileTap={{ scale: 0.95 }}
      >
        {isRecording ? (
          <Square className="w-7 h-7 text-white" />
        ) : (
          <Mic className="w-8 h-8 text-white" />
        )}
      </motion.button>
    </div>
  );
}
