
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlayIcon, PauseIcon, DownloadIcon } from 'lucide-react';
import { formatTime } from '@/utils/format-time';
import { updateProcessingEntry } from '@/utils/audio/processing-state';
import { cn } from '@/lib/utils';

interface PlaybackControlsProps {
  audioUrl?: string | null;
  audioBlob?: Blob | null;
  isPlaying?: boolean;
  isProcessing?: boolean;
  playbackProgress?: number;
  audioDuration: number;
  tempId?: string;
  onTogglePlayback?: () => void;
  onSaveEntry?: () => void;
  onRestart?: () => void;
  onSeek?: (position: number) => void;
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({ 
  audioUrl, 
  audioBlob,
  isPlaying = false,
  isProcessing = false,
  playbackProgress = 0,
  audioDuration, 
  tempId,
  onTogglePlayback,
  onSaveEntry,
  onRestart,
  onSeek
}) => {
  const [isPlayingInternal, setIsPlayingInternal] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      // No need to update state here
    };

    const handleEnded = () => {
      setIsPlayingInternal(false);
    };

    if (audio) {
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
    }

    return () => {
      if (audio) {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
      }
    };
  }, [audioUrl]);

  // Update local state when prop changes
  useEffect(() => {
    setIsPlayingInternal(isPlaying);
  }, [isPlaying]);

  const togglePlayback = () => {
    if (onTogglePlayback) {
      onTogglePlayback();
      return;
    }

    if (!audioUrl && !audioBlob) return;

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlayingInternal) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlayingInternal(!isPlayingInternal);
  };

  const handleDownload = () => {
    if (!audioUrl && !audioBlob) return;

    const link = document.createElement('a');
    
    if (audioUrl) {
      link.href = audioUrl;
    } else if (audioBlob) {
      link.href = URL.createObjectURL(audioBlob);
    } else {
      return;
    }
    
    link.download = 'recording.wav';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (audioBlob) {
      URL.revokeObjectURL(link.href);
    }
  };

  const handleSave = () => {
    if (onSaveEntry) {
      onSaveEntry();
    }
  };

  const handleRestart = () => {
    if (onRestart) {
      onRestart();
    }
  };

  // Render appropriate controls based on available props
  const renderControls = () => {
    if (onSaveEntry && onRestart) {
      return (
        <div className="flex space-x-2 mt-2">
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleSave}
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "Save"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRestart}
          >
            New Recording
          </Button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col items-center space-y-2">
      <audio ref={audioRef} src={audioUrl || (audioBlob ? URL.createObjectURL(audioBlob) : undefined)} preload="metadata" />
      
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={togglePlayback}
          aria-label={isPlayingInternal ? "Pause" : "Play"}
          disabled={!audioUrl && !audioBlob}
        >
          {isPlayingInternal ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
        </Button>
        <span className="text-sm">{formatTime(audioDuration * 1000)}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          aria-label="Download"
          disabled={!audioUrl && !audioBlob}
        >
          <DownloadIcon className="h-4 w-4" />
        </Button>
      </div>
      
      {renderControls()}
      
      {playbackProgress > 0 && onSeek && (
        <div className="w-full max-w-xs mt-2">
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={playbackProgress * 100} 
            onChange={(e) => {
              if (onSeek) onSeek(Number(e.target.value) / 100);
            }}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

export default PlaybackControls;
