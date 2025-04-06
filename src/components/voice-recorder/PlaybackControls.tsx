
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PlaybackControlsProps {
  audioBlob: Blob | null;
  isPlaying: boolean;
  isProcessing: boolean;
  playbackProgress: number;
  audioDuration: number;
  onTogglePlayback: () => void;
  onSaveEntry: () => void;
  onRestart: () => void;
}

export function PlaybackControls({
  audioBlob,
  isPlaying,
  isProcessing,
  playbackProgress,
  audioDuration,
  onTogglePlayback,
  onSaveEntry,
  onRestart
}: PlaybackControlsProps) {
  // Calculate the current time based on the progress and total duration
  const currentTime = playbackProgress * (audioDuration || 0);
  const formattedProgress = formatTime(currentTime);
  const formattedDuration = formatTime(audioDuration || 0); // Add fallback for zero duration
  
  // Track previous progress for animation smoothness
  const prevProgressRef = useRef(playbackProgress);
  
  // Use animation that respects the current progress position
  useEffect(() => {
    prevProgressRef.current = playbackProgress;
  }, [playbackProgress]);
  
  // Handle save click with error prevention
  const handleSaveClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any default form actions
    
    if (!isProcessing && audioBlob) {
      try {
        console.log("Save button clicked, calling onSaveEntry");
        onSaveEntry();
      } catch (err) {
        console.error("Error in save handler:", err);
      }
    } else {
      console.log("Save button clicked but disabled condition: isProcessing=", isProcessing, "audioBlob=", !!audioBlob);
    }
  };
  
  return (
    <div className="w-full px-4">
      <div className="mb-4 relative">
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: `${(prevProgressRef.current || 0) * 100}%` }}
            animate={{ width: `${playbackProgress * 100}%` }}
            transition={{ type: "tween", duration: 0.1 }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-slate-500">
          <span>{formattedProgress}</span>
          <span>{formattedDuration}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mt-6">
        {/* Play/Pause Button */}
        <Button 
          onClick={onTogglePlayback}
          variant="ghost" 
          size="icon"
          className="w-10 h-10 rounded-full border"
          disabled={isProcessing || !audioBlob}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>
        
        {/* Save Button */}
        <Button 
          onClick={handleSaveClick}
          disabled={isProcessing || !audioBlob}
          variant="default"
          className="relative"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : "Save"}
        </Button>
        
        {/* Restart Button */}
        <Button 
          onClick={onRestart}
          variant="ghost" 
          size="icon"
          className="w-10 h-10 rounded-full border"
          disabled={isProcessing}
        >
          <RotateCcw className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "0:00";
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
