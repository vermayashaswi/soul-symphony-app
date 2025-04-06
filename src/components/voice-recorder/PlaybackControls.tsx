
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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
          onClick={onSaveEntry}
          disabled={isProcessing || !audioBlob}
          variant="default"
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
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
