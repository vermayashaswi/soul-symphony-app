import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Play, RotateCcw, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { clearAllToasts } from '@/services/unifiedNotificationService';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDebugLog } from '@/utils/debug/DebugContext';
import { updateProcessingEntries } from '@/utils/audio/processing-state';

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
  const [processingStartTime, setProcessingStartTime] = useState(0);
  const { isMobile } = useIsMobile();
  const { addEvent } = useDebugLog();
  
  useEffect(() => {
    if (!isTouchActive && playbackProgress !== undefined) {
      const timeInSeconds = (playbackProgress * audioDuration);
      setCurrentTime(timeInSeconds);
      setSliderValue(playbackProgress * 100);
      
      addEvent('PlaybackControls', 'Progress update', 'info', {
        progress: playbackProgress,
        timeInSeconds,
        audioDuration,
        sliderValue: playbackProgress * 100
      });
    }
  }, [playbackProgress, audioDuration, isTouchActive, addEvent]);
  
  useEffect(() => {
    if (isProcessing && processingStartTime === 0) {
      setProcessingStartTime(Date.now());
    } else if (!isProcessing && processingStartTime !== 0) {
      setProcessingStartTime(0);
    }
    
    if (isProcessing && processingStartTime > 0) {
      const processingTime = Date.now() - processingStartTime;
      if (processingTime > 45000) {
        addEvent('PlaybackControls', 'Processing taking too long', 'warning', {
          processingTime
        });
      }
    }
  }, [isProcessing, processingStartTime, addEvent]);
  
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleSliderChange = (value: number[]) => {
    const newPosition = value[0] / 100;
    setSliderValue(value[0]);
    setCurrentTime(newPosition * audioDuration);
    
    addEvent('PlaybackControls', 'Slider changed', 'info', {
      value: value[0],
      newPosition,
      newTimeInSeconds: newPosition * audioDuration
    });
    
    if (onSeek) {
      onSeek(newPosition);
    }
  };
  
  const handleTouchStart = () => {
    setIsTouchActive(true);
  };
  
  const handleTouchEnd = () => {
    if (onSeek && sliderValue !== undefined) {
      onSeek(sliderValue / 100);
    }
    
    setTimeout(() => {
      setIsTouchActive(false);
    }, 100);
  };
  
  const handleSaveEntry = async () => {
    addEvent('ProcessingFlow', 'Save entry initiated', 'info');
    
    if (!audioBlob || audioBlob.size < 100) {
      addEvent('ProcessingFlow', 'Invalid audio blob for saving', 'error', { 
        size: audioBlob?.size 
      });
      return;
    }
    
    setIsClearingToasts(true);
    await clearAllToasts();
    
    const tempId = 'temp-' + Date.now();
    addEvent('ProcessingFlow', 'Dispatching immediate processing event', 'info', { tempId });
    
    updateProcessingEntries(tempId, 'add');
    
    window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
      detail: { 
        entries: [tempId], 
        lastUpdate: Date.now(),
        forceUpdate: true,
        showLoader: true
      }
    }));
    
    setTimeout(() => {
      addEvent('ProcessingFlow', 'Sending followup processing event', 'info', { tempId });
      window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
        detail: { 
          entries: [tempId], 
          lastUpdate: Date.now(),
          forceUpdate: true,
          showLoader: true
        }
      }));
    }, 50);
    
    setTimeout(() => {
      addEvent('ProcessingFlow', 'Sending third processing event', 'info', { tempId });
      window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
        detail: { 
          entries: [tempId], 
          lastUpdate: Date.now(),
          forceUpdate: true,
          showLoader: true
        }
      }));
    }, 200);
    
    setTimeout(() => {
      addEvent('ProcessingFlow', 'Sending journal refresh event', 'info', { tempId });
      window.dispatchEvent(new CustomEvent('journalEntriesNeedRefresh', {
        detail: { 
          tempId,
          timestamp: Date.now(),
          forceRefresh: true
        }
      }));
    }, 300);
    
    setTimeout(() => {
      setIsClearingToasts(false);
      addEvent('ProcessingFlow', 'Calling onSaveEntry callback', 'info');
      onSaveEntry();
    }, 150);
  };
  
  return (
    <div className="w-full px-4 py-2">
      <div className="flex flex-col w-full gap-3">
        <div className="flex items-center gap-3 mb-1 w-full">
          <div className="relative w-full flex items-center">
            <Slider
              value={[sliderValue]}
              min={0}
              max={100}
              step={0.1}
              className={cn(
                "w-full transition-opacity", 
                (isProcessing) ? "opacity-60 cursor-not-allowed" : ""
              )}
              onValueChange={handleSliderChange}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleTouchStart}
              onMouseUp={handleTouchEnd}
              disabled={isProcessing}
            />
          </div>
          
          <div className="text-sm text-muted-foreground w-[60px] text-right">
            {formatTime(currentTime)}/{formatTime(audioDuration)}
          </div>
        </div>
        
        <div className="flex justify-center items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            className="rounded-full w-10 h-10"
            onClick={onTogglePlayback}
            disabled={isProcessing}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon"
            className="rounded-full w-10 h-10"
            onClick={onRestart}
            disabled={isProcessing}
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
          
          <Button 
            variant="default" 
            className="rounded-full px-4 bg-green-600 hover:bg-green-700 ml-2"
            onClick={handleSaveEntry}
            disabled={isProcessing || isClearingToasts || !audioBlob || audioBlob.size < 100}
          >
            {isProcessing || isClearingToasts ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 
                {isClearingToasts ? 'Preparing...' : 'Processing...'}
              </>
            ) : (
              'Save Entry'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
