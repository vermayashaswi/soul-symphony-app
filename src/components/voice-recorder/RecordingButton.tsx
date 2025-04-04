
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
}

export function RecordingButton({
  isRecording,
  isProcessing,
  hasPermission,
  onRecordingStart,
  onRecordingStop,
  onPermissionRequest,
  audioLevel = 0
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
  
  // Calculate scale based on audio level
  const maxScale = 1.2;
  const scaleAmount = isRecording 
    ? 1 + ((audioLevel / 100) * (maxScale - 1)) 
    : 1;
    
  // Subtle color shift based on audio level
  const getButtonColor = () => {
    if (isProcessing) return "bg-gray-400 border-gray-500";
    if (!isRecording) return "bg-primary hover:bg-primary/90 border-primary/20";
    
    // When recording, shift color based on audio level
    const intensity = Math.min(100, audioLevel * 1.2);
    return `bg-red-500 border-red-600`;
  };
  
  // Dynamic glow effect based on audio level
  const glowSize = isRecording ? Math.max(4, Math.min(20, audioLevel / 5)) : 0;
  
  return (
    <motion.button
      onClick={isRecording ? onRecordingStop : onRecordingStart}
      disabled={isProcessing}
      className={cn(
        "relative z-10 rounded-full flex items-center justify-center border transition-all duration-300 shadow-lg",
        getButtonColor(),
        isRecording ? "w-20 h-20" : isProcessing ? "w-20 h-20 opacity-50 cursor-not-allowed" : "w-20 h-20",
      )}
      style={{
        boxShadow: isRecording ? `0 0 ${glowSize}px ${glowSize/2}px rgba(239, 68, 68, 0.6)` : undefined
      }}
      whileTap={{ scale: 0.95 }}
      animate={{ 
        scale: scaleAmount,
        transition: { duration: 0.15 }
      }}
    >
      {isRecording ? (
        <Square className="w-7 h-7 text-white" />
      ) : (
        <Mic className="w-8 h-8 text-white" />
      )}
    </motion.button>
  );
}
