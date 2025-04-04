
import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatTime } from '@/utils/format-time';

interface PlaybackControlsProps {
  audioBlob: Blob | null;
  isPlaying: boolean;
  isProcessing: boolean;
  playbackProgress: number;
  audioDuration: number;
  onTogglePlayback: () => void;
  onSaveEntry: () => void;
}

export function PlaybackControls({
  audioBlob,
  isPlaying,
  isProcessing,
  playbackProgress,
  audioDuration,
  onTogglePlayback,
  onSaveEntry
}: PlaybackControlsProps) {
  if (!audioBlob) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center gap-2 w-full max-w-xs"
    >
      <div className="w-full">
        <Button 
          onClick={onTogglePlayback} 
          variant="outline"
          disabled={isProcessing}
          className="rounded-full h-8 px-3 flex items-center gap-1.5 w-full mb-1 text-xs"
          size="sm"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3 h-3" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              <span>Play Recording</span>
            </>
          )}
        </Button>
        
        {/* Playback progress indicator */}
        <div className="w-full space-y-0.5">
          <Progress value={playbackProgress} className="h-1.5" />
          <div className="flex justify-between text-[0.65rem] text-muted-foreground">
            <span>
              {formatTime(Math.floor((playbackProgress / 100) * (audioDuration || 0)))}
            </span>
            <span>{formatTime(Math.floor(audioDuration || 0))}</span>
          </div>
        </div>
      </div>
      
      <Button 
        onClick={onSaveEntry}
        disabled={isProcessing}
        className="w-full mt-1 rounded-lg flex items-center justify-center gap-1.5 h-8 text-xs"
        size="sm"
      >
        <span>Save Entry</span>
      </Button>
    </motion.div>
  );
}
