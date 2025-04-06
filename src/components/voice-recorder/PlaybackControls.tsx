
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { clearAllToasts } from '@/services/notificationService';

interface PlaybackControlsProps {
  audioBlob: Blob | null;
  isPlaying: boolean;
  isProcessing: boolean;
  playbackProgress: number;
  audioDuration: number;
  onTogglePlayback: () => void;
  onSaveEntry: () => void;
  onRestart: () => void;
  onSeek?: (position: number) => void;
}

export function PlaybackControls({
  audioBlob,
  isPlaying,
  isProcessing,
  playbackProgress,
  audioDuration,
  onTogglePlayback,
  onSaveEntry,
  onRestart,
  onSeek
}: PlaybackControlsProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isClearingToasts, setIsClearingToasts] = useState(false);
  
  // Calculate current time based on progress and duration
  useEffect(() => {
    const timeInSeconds = (playbackProgress * audioDuration);
    setCurrentTime(timeInSeconds);
  }, [playbackProgress, audioDuration]);
  
  const formattedProgress = formatTime(currentTime);
  const formattedDuration = formatTime(audioDuration);
  
  const handleSliderChange = (value: number[]) => {
    if (onSeek) {
      const position = value[0] / 100;
      onSeek(position);
    }
  };

  // Function to ensure all toasts are completely cleared
  const handleSaveClick = async () => {
    setIsClearingToasts(true);
    
    // First force clear any existing toasts
    clearAllToasts();
    
    // Give some time for the DOM to update
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Clear again to ensure any new toasts are also cleared
    clearAllToasts();
    
    // Wait a bit more for any lingering DOM effects
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Try to find any remaining toast elements and force remove them
    try {
      const toastElements = document.querySelectorAll('[data-sonner-toast]');
      if (toastElements.length > 0) {
        console.log(`[PlaybackControls] Found ${toastElements.length} lingering toasts, removing manually`);
        toastElements.forEach(el => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
      }
      
      // Also try to clear any toast containers from the DOM
      const toastContainers = document.querySelectorAll('[data-sonner-toaster]');
      if (toastContainers.length > 0) {
        console.log(`[PlaybackControls] Found ${toastContainers.length} toast containers`);
        // Don't remove containers as they're needed, but clear their children
        toastContainers.forEach(container => {
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }
        });
      }
    } catch (e) {
      console.error('[PlaybackControls] Error trying to manually clear toasts:', e);
    }
    
    // Final safety check
    clearAllToasts();
    
    // Now it's safe to proceed with the save operation
    setIsClearingToasts(false);
    onSaveEntry();
  };
  
  return (
    <div className="w-full px-4">
      <div className="mb-4 relative">
        <Slider
          defaultValue={[0]}
          value={[playbackProgress * 100]}
          max={100}
          step={0.1}
          onValueChange={handleSliderChange}
          disabled={isProcessing || !audioBlob}
          className="mb-2"
        />
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
          disabled={isProcessing || !audioBlob || isClearingToasts}
          variant="default"
        >
          {isProcessing || isClearingToasts ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isClearingToasts ? "Preparing..." : "Processing..."}
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
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
