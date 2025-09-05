import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PulsatingRecordButtonProps {
  isRecording: boolean;
  isLoading: boolean;
  recordingTime: string;
  audioLevel: number;
  onToggleRecording: () => void;
  disabled?: boolean;
}

export const PulsatingRecordButton: React.FC<PulsatingRecordButtonProps> = ({
  isRecording,
  isLoading,
  recordingTime,
  audioLevel,
  onToggleRecording,
  disabled = false
}) => {
  // Calculate pulsation intensity based on audio level (0-1)
  const pulsationScale = isRecording ? 1 + (audioLevel * 0.3) : 1;
  
  return (
    <div className="flex flex-col items-center">
      <motion.div
        animate={{
          scale: isRecording ? [1, pulsationScale, 1] : 1,
        }}
        transition={{
          duration: isRecording ? 0.2 : 0.3,
          repeat: isRecording ? Infinity : 0,
          ease: "easeInOut"
        }}
      >
        <Button
          onClick={onToggleRecording}
          disabled={disabled || isLoading}
          className={`
            w-20 h-20 rounded-full p-0 transition-all duration-300
            ${isRecording 
              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30' 
              : 'bg-white hover:bg-white/90 shadow-lg'
            }
          `}
        >
          {isLoading ? (
            <Loader2 className={`h-8 w-8 animate-spin ${isRecording ? 'text-white' : 'text-purple-800'}`} />
          ) : isRecording ? (
            <Square className="h-8 w-8 text-white" />
          ) : (
            <Mic className="h-8 w-8 text-purple-800" />
          )}
        </Button>
      </motion.div>
      
      {/* Audio level visualization */}
      {isRecording && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex items-center gap-1"
        >
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 bg-white/60 rounded-full"
              animate={{
                height: audioLevel > (i * 0.2) ? [8, 16, 8] : 8,
              }}
              transition={{
                duration: 0.2,
                repeat: audioLevel > (i * 0.2) ? Infinity : 0,
                ease: "easeInOut"
              }}
            />
          ))}
        </motion.div>
      )}
      
      {/* Recording time - only show if recordingTime is provided */}
      {isRecording && recordingTime && recordingTime.trim() !== '' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-white/80 text-sm font-mono"
        >
          {recordingTime}
        </motion.div>
      )}
    </div>
  );
};