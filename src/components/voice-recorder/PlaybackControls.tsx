
import React, { useEffect, useState } from 'react';
import { Play, Pause, Save, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { formatTime } from '@/utils/format-time';
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
  onSeek: (position: number) => void;
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
  const [seekValue, setSeekValue] = useState(0);
  const [isSaveRequested, setIsSaveRequested] = useState(false);
  
  // Always update local state when playback progress changes
  useEffect(() => {
    setSeekValue(playbackProgress * 100);
  }, [playbackProgress]);
  
  // Track seek events to properly update the UI
  const handleSeekChange = (value: number[]) => {
    const seekPosition = value[0] / 100;
    setSeekValue(value[0]);
    onSeek(seekPosition);
  };
  
  // Safer save entry handling with toast clearing
  const handleSafeEntryRequest = async () => {
    // Only allow save once
    if (isSaveRequested) return;
    
    console.log('[PlaybackControls] Save requested, clearing all toasts first');
    setIsSaveRequested(true);
    
    // Clear any toast notifications to prevent UI conflicts
    clearAllToasts();
    
    // Let the UI process the toast clearing
    setTimeout(() => {
      // Double-check clear to ensure UI is clean
      clearAllToasts();
      
      // Now it's safe to call the save function
      onSaveEntry();
    }, 100);
  };
  
  return (
    <div className="w-full max-w-md flex flex-col gap-4 px-6">
      <div className="w-full flex justify-between items-center">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatTime(playbackProgress * audioDuration)}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatTime(audioDuration)}
        </span>
      </div>
      
      <Slider
        value={[seekValue]}
        min={0}
        max={100}
        step={0.1}
        disabled={isProcessing || !audioBlob}
        onValueChange={handleSeekChange}
        className="w-full"
      />
      
      <div className="w-full flex justify-between items-center mt-4">
        <Button
          size="icon"
          variant="outline"
          onClick={() => {
            // Clear toasts before restart
            clearAllToasts();
            onRestart();
          }}
          disabled={isProcessing || !audioBlob}
          className="rounded-full"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        
        <Button
          size="icon"
          variant={isPlaying ? "destructive" : "default"}
          onClick={() => {
            // Clear toasts before playback
            clearAllToasts();
            onTogglePlayback();
          }}
          disabled={isProcessing || !audioBlob}
          className="w-12 h-12 rounded-full"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>
        
        <Button
          size="icon"
          variant="outline"
          onClick={handleSafeEntryRequest}
          disabled={isProcessing || !audioBlob || isSaveRequested}
          className={`rounded-full ${isProcessing ? 'bg-muted' : ''}`}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
