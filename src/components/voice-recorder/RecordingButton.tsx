
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
  
  // Calculate scale based on audio level - making it 3x more prominent
  const maxScale = 1.6; // Increased from 1.2 to make the effect more prominent
  const scaleAmount = isRecording 
    ? 1 + ((audioLevel / 100) * (maxScale - 1) * 3) // Multiplied by 3 to make it three times more prominent
    : 1;
    
  // Subtle color shift based on audio level
  const getButtonColor = () => {
    if (isProcessing) return "bg-gray-400 border-gray-500";
    if (!isRecording) return "bg-theme-color hover:bg-theme-color/90 border-theme-color/20";
    
    // When recording, shift color based on audio level
    return `bg-red-500 border-red-600`;
  };
  
  // Dynamic glow effect based on audio level - increased by 3x
  const glowSize = isRecording ? Math.max(12, Math.min(60, audioLevel / 5 * 3)) : 0; // Tripled the values
  
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
        boxShadow: isRecording ? `0 0 ${glowSize}px ${glowSize/2}px rgba(239, 68, 68, 0.8)` : undefined // Increased opacity from 0.6 to 0.8
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
