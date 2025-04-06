
import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Save } from 'lucide-react';
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
  onRestart?: () => void;
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
  if (!audioBlob) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center gap-3 w-full max-w-xs"
    >
      <div className="w-full">
        {/* Playback progress indicator */}
        <div className="w-full space-y-1 mb-4">
          <Progress value={playbackProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {formatTime(Math.floor((playbackProgress / 100) * (audioDuration || 0)))}
            </span>
            <span>{formatTime(Math.floor(audioDuration || 0))}</span>
          </div>
        </div>
        
        {/* Control buttons in a single row */}
        <div className="flex items-center justify-between w-full gap-2 mb-4">
          <Button
            onClick={onTogglePlayback}
            variant="outline"
            disabled={isProcessing}
            size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          
          <Button
            onClick={onSaveEntry}
            disabled={isProcessing}
            className="flex-grow rounded-lg flex items-center justify-center"
          >
            <span>Save Entry</span>
          </Button>
          
          <Button
            onClick={onRestart}
            variant="outline"
            disabled={isProcessing}
            size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
