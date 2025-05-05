import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlayIcon, PauseIcon, DownloadIcon } from 'lucide-react';
import { formatTime } from '@/utils/format-time';
import { updateProcessingEntry } from '@/utils/audio/processing-state';
import { cn } from '@/lib/utils';

interface PlaybackControlsProps {
  audioUrl: string | null;
  duration: number;
  tempId?: string;
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({ audioUrl, duration, tempId }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      // No need to update state here
    };

    const handleEnded = () => {
      setIsPlaying(false);
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

  const togglePlayback = () => {
    if (!audioUrl) return;

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    if (!audioUrl) return;

    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = 'recording.wav';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex items-center space-x-2">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <Button
        variant="outline"
        size="icon"
        onClick={togglePlayback}
        aria-label={isPlaying ? "Pause" : "Play"}
        disabled={!audioUrl}
      >
        {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
      </Button>
      <span className="text-sm">{formatTime(duration)}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDownload}
        aria-label="Download"
        disabled={!audioUrl}
      >
        <DownloadIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default PlaybackControls;
