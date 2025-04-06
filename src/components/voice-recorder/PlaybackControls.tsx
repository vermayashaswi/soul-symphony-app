
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { clearAllToasts, ensureAllToastsCleared } from '@/services/notificationService';

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
  const [clearAttempts, setClearAttempts] = useState(0);
  const [allToastsCleared, setAllToastsCleared] = useState(false);
  
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

  // Comprehensive toast clearing and save function that fully replicates the manual swipe behavior
  const handleSaveClick = async () => {
    console.log('[PlaybackControls] Save button clicked, starting toast cleanup sequence');
    
    // Prevent multiple simultaneous save attempts
    if (isClearingToasts) {
      console.log('[PlaybackControls] Already clearing toasts, ignoring duplicate save request');
      return;
    }
    
    setIsClearingToasts(true);
    setAllToastsCleared(false);
    setClearAttempts(0);
    
    try {
      // Step 1: First round of toast clearing with the enhanced method
      console.log('[PlaybackControls] Step 1: Initial toast clearing');
      await ensureAllToastsCleared();
      setClearAttempts(prev => prev + 1);
      
      // Step 2: Wait for DOM updates and animations to complete
      console.log('[PlaybackControls] Step 2: Waiting for DOM updates');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Step 3: Second round of toast clearing
      console.log('[PlaybackControls] Step 3: Second round of toast clearing');
      await ensureAllToastsCleared();
      setClearAttempts(prev => prev + 1);
      
      // Step 4: Direct DOM manipulation to forcefully remove any lingering toast elements
      console.log('[PlaybackControls] Step 4: Direct DOM manipulation');
      try {
        // Find and remove any toast elements that might be lingering
        const toastElements = document.querySelectorAll('[data-sonner-toast]');
        if (toastElements.length > 0) {
          console.log(`[PlaybackControls] Found ${toastElements.length} lingering toasts, removing manually`);
          toastElements.forEach(el => {
            try {
              if (el.parentNode) {
                // Add fade-out animation before removal for smoother transition
                el.style.opacity = '0';
                el.style.transform = 'translateY(-10px)';
                el.style.transition = 'opacity 100ms ease, transform 100ms ease';
                
                // Remove after transition
                setTimeout(() => {
                  if (el.parentNode) {
                    el.parentNode.removeChild(el);
                  }
                }, 100);
              }
            } catch (err) {
              console.error('[PlaybackControls] Error removing individual toast element:', err);
            }
          });
        }
        
        // Clear toast containers by removing their children
        const toastContainers = document.querySelectorAll('[data-sonner-toaster]');
        if (toastContainers.length > 0) {
          console.log(`[PlaybackControls] Found ${toastContainers.length} toast containers`);
          toastContainers.forEach(container => {
            try {
              // Don't remove the container itself, just clear its children
              while (container.firstChild) {
                container.removeChild(container.firstChild);
              }
            } catch (err) {
              console.error('[PlaybackControls] Error clearing toast container children:', err);
            }
          });
        }
        
        // Also look for any toast portals or other related elements
        const toastPortals = document.querySelectorAll('[id^="sonner"]');
        if (toastPortals.length > 0) {
          console.log(`[PlaybackControls] Found ${toastPortals.length} sonner portals`);
          toastPortals.forEach(portal => {
            try {
              while (portal.firstChild) {
                portal.removeChild(portal.firstChild);
              }
            } catch (err) {
              console.error('[PlaybackControls] Error clearing toast portal children:', err);
            }
          });
        }
      } catch (e) {
        console.error('[PlaybackControls] Error during direct DOM manipulation:', e);
      }
      
      // Step 5: Final toast clearing to ensure no new toasts appeared
      console.log('[PlaybackControls] Step 5: Final toast clearing');
      await ensureAllToastsCleared();
      setClearAttempts(prev => prev + 1);
      
      // Step 6: Reset internal state of toast systems
      console.log('[PlaybackControls] Step 6: Resetting toast state');
      // Force clear using standard method one more time
      clearAllToasts();
      
      // Step 7: Final check for any remaining toast elements
      const remainingToasts = document.querySelectorAll('[data-sonner-toast]');
      if (remainingToasts.length > 0) {
        console.warn(`[PlaybackControls] ${remainingToasts.length} toasts still remain after cleanup sequence`);
        // One last forceful attempt
        remainingToasts.forEach(el => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
      } else {
        console.log('[PlaybackControls] All toasts successfully cleared');
      }
      
      // All toasts should be cleared by now
      setAllToastsCleared(true);
      
      // Step 8: Small delay before proceeding with save to ensure clean UI state
      console.log('[PlaybackControls] Step 8: Final delay before saving');
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Step 9: Now it's safe to proceed with the actual save operation
      console.log('[PlaybackControls] Step 9: Executing save operation');
      onSaveEntry();
    } catch (error) {
      console.error('[PlaybackControls] Error during toast clearing sequence:', error);
      // Still try to save even if toast clearing had errors
      onSaveEntry();
    } finally {
      setIsClearingToasts(false);
    }
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
              {isClearingToasts ? (clearAttempts > 0 ? "Preparing UI..." : "Clearing notifications...") : "Processing..."}
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
