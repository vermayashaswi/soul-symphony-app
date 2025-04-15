
import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { clearAllToasts } from '@/services/notificationService';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [sliderValue, setSliderValue] = useState(0);
  const [isTouchActive, setIsTouchActive] = useState(false);
  const { isMobile } = useIsMobile();
  const lastDurationRef = useRef<number>(0);
  
  // Fix for zero duration audio - use a minimum valid duration
  const effectiveDuration = audioDuration <= 0 ? 1 : audioDuration;
  
  // Anti-flicker mechanism - only update duration if it's stable
  const stableDuration = useRef<number>(effectiveDuration);
  
  useEffect(() => {
    if (Math.abs(effectiveDuration - lastDurationRef.current) > 0.1) {
      lastDurationRef.current = effectiveDuration;
    }
  }, [effectiveDuration]);
  
  // Update slider and current time based on playback progress, with anti-flicker
  useEffect(() => {
    if (!isTouchActive && playbackProgress !== undefined && lastDurationRef.current > 0) {
      const timeInSeconds = (playbackProgress * lastDurationRef.current);
      setCurrentTime(timeInSeconds);
      setSliderValue(playbackProgress * 100);
    }
  }, [playbackProgress, isTouchActive]);
  
  // Force update the slider position during playback with requestAnimationFrame
  useEffect(() => {
    let animationFrameId: number;
    
    if (isPlaying && !isTouchActive) {
      const updateSlider = () => {
        setSliderValue(prev => {
          // Only update if there's a real change to prevent unnecessary renders
          const newValue = playbackProgress * 100;
          if (Math.abs(prev - newValue) > 0.5) {
            return newValue;
          }
          return prev;
        });
        setCurrentTime(playbackProgress * lastDurationRef.current);
        animationFrameId = requestAnimationFrame(updateSlider);
      };
      
      animationFrameId = requestAnimationFrame(updateSlider);
    }
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying, playbackProgress, isTouchActive]);
  
  const formattedProgress = formatTime(currentTime);
  const formattedDuration = formatTime(lastDurationRef.current);
  
  const handleSliderChange = (value: number[]) => {
    if (onSeek) {
      const position = value[0] / 100;
      setSliderValue(value[0]);
      setCurrentTime(position * lastDurationRef.current);
      onSeek(position);
    }
  };

  // Function to ensure all toasts are completely cleared
  const handleSaveClick = async () => {
    // Always allow saving even if duration is 0
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
      <div className="mb-4 relative">
        <Slider
          defaultValue={[0]}
          value={[sliderValue]}
          max={100}
          step={0.1}
          onValueChange={handleSliderChange}
          disabled={isProcessing || !audioBlob}
          className="mb-2"
          onTouchStart={() => setIsTouchActive(true)}
          onTouchEnd={() => setIsTouchActive(false)}
          onPointerDown={() => setIsTouchActive(true)}
          onPointerUp={() => setIsTouchActive(false)}
        />
        <div className="flex justify-between mt-1.5 text-xs text-slate-500">
          <span>{formattedProgress}</span>
          <span>{formattedDuration}</span>
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

function formatTime(seconds: number): string {
  // Ensure seconds is at least 0
  seconds = Math.max(0, seconds);
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
