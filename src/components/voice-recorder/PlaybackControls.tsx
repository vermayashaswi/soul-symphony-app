
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { clearAllToasts } from '@/services/notificationService';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatTime } from '@/utils/format-time';

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
  const { isMobile } = useIsMobile();
  
  // Update current time based on playback progress
  useEffect(() => {
    const timeInSeconds = (playbackProgress * audioDuration);
    setCurrentTime(timeInSeconds);
  }, [playbackProgress, audioDuration]);
  
  // Safely convert time to milliseconds for formatting
  const timeToMilliseconds = (timeInSeconds: number) => {
    return Math.floor(timeInSeconds * 1000);
  };
  
  const formattedProgress = formatTime(timeToMilliseconds(currentTime));
  const formattedDuration = formatTime(timeToMilliseconds(audioDuration || 0));
  
  // Log important timing values for debugging
  useEffect(() => {
    console.log('[PlaybackControls] Time values:', {
      playbackProgress,
      audioDuration,
      currentTime,
      formattedProgress,
      formattedDuration
    });
  }, [playbackProgress, audioDuration, currentTime]);

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
    <div className={cn("w-full px-4", isMobile ? "px-2" : "px-4")}>
      <div className="mb-4 relative text-center">
        <div className="text-base font-medium tracking-wide">
          {formattedProgress} / {formattedDuration}
        </div>
      </div>

      <div className={cn(
        "flex items-center justify-center gap-4 mt-6",
        isMobile ? "gap-2" : "gap-4"
      )}>
        {/* Play/Pause Button */}
        <Button 
          onClick={onTogglePlayback}
          variant="ghost" 
          size="icon"
          className={cn(
            "rounded-full border",
            isMobile ? "w-12 h-12" : "w-10 h-10"
          )}
          disabled={isProcessing || !audioBlob}
        >
          {isPlaying ? (
            <Pause className={cn(isMobile ? "h-6 w-6" : "h-5 w-5")} />
          ) : (
            <Play className={cn(isMobile ? "h-6 w-6 ml-0.5" : "h-5 w-5 ml-0.5")} />
          )}
        </Button>
        
        {/* Save Button */}
        <Button 
          onClick={handleSaveClick}
          disabled={isProcessing || !audioBlob || isClearingToasts}
          variant="default"
          className={cn(isMobile ? "px-6 py-2 text-sm h-10" : "")}
        >
          {isProcessing || isClearingToasts ? (
            <>
              <Loader2 className={cn("mr-2 animate-spin", isMobile ? "h-4 w-4" : "h-4 w-4")} />
              {isClearingToasts ? "Preparing..." : "Processing..."}
            </>
          ) : "Save"}
        </Button>
        
        {/* Restart Button */}
        <Button 
          onClick={onRestart}
          variant="ghost" 
          size="icon"
          className={cn(
            "rounded-full border",
            isMobile ? "w-12 h-12" : "w-10 h-10"
          )}
          disabled={isProcessing}
        >
          <RotateCcw className={cn(isMobile ? "h-6 w-6" : "h-5 w-5")} />
        </Button>
      </div>
    </div>
  );
}
