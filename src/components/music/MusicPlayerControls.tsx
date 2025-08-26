import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  SkipBack, 
  SkipForward, 
  Repeat, 
  Repeat1, 
  Play,
  Volume2,
  Info
} from 'lucide-react';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { PlaybackMode } from '@/types/music';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface MusicPlayerControlsProps {
  className?: string;
}

export function MusicPlayerControls({ className }: MusicPlayerControlsProps) {
  const {
    isPlaying,
    currentCategory,
    playbackMode,
    currentTrackIndex,
    trackProgress,
    categoryProgress,
    setPlaybackMode,
    previousTrack,
    nextTrack,
    getCurrentTrackInfo
  } = useMusicPlayer();

  const trackInfo = getCurrentTrackInfo();

  if (!isPlaying || !currentCategory || !trackInfo) {
    return null;
  }

  const getPlaybackModeIcon = () => {
    switch (playbackMode) {
      case 'single':
        return <Repeat1 className="h-4 w-4" />;
      case 'once':
        return <Play className="h-4 w-4" />;
      case 'loop':
      default:
        return <Repeat className="h-4 w-4" />;
    }
  };

  const getPlaybackModeLabel = () => {
    switch (playbackMode) {
      case 'single':
        return 'Repeat Track';
      case 'once':
        return 'Play Once';
      case 'loop':
      default:
        return 'Loop Category';
    }
  };

  return (
    <div className={`bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg p-4 space-y-3 ${className}`}>
      {/* Track Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div 
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: currentCategory.color }}
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-foreground truncate">
              {trackInfo.name}
            </h4>
            <p className="text-xs text-muted-foreground">
              {currentCategory.name} • Track {trackInfo.index + 1} of {trackInfo.total}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Volume2 className="h-3 w-3" />
          <span>{Math.round(trackProgress * 100)}%</span>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span><TranslatableText text="Track Progress" /></span>
            <span>{Math.round(trackProgress * 100)}%</span>
          </div>
          <Progress 
            value={trackProgress * 100} 
            className="h-1.5"
          />
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span><TranslatableText text="Category Progress" /></span>
            <span>{Math.round(categoryProgress * 100)}%</span>
          </div>
          <Progress 
            value={categoryProgress * 100} 
            className="h-1.5"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={previousTrack}
            className="h-8 w-8 p-0"
          >
            <SkipBack className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={nextTrack}
            className="h-8 w-8 p-0"
          >
            <SkipForward className="h-3 w-3" />
          </Button>
        </div>

        <Select 
          value={playbackMode} 
          onValueChange={(value: PlaybackMode) => setPlaybackMode(value)}
        >
          <SelectTrigger className="w-auto h-8 text-xs gap-1 border-0 bg-transparent hover:bg-muted">
            {getPlaybackModeIcon()}
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="loop">
              <div className="flex items-center gap-2">
                <Repeat className="h-3 w-3" />
                <TranslatableText text="Loop Category" />
              </div>
            </SelectItem>
            <SelectItem value="single">
              <div className="flex items-center gap-2">
                <Repeat1 className="h-3 w-3" />
                <TranslatableText text="Repeat Track" />
              </div>
            </SelectItem>
            <SelectItem value="once">
              <div className="flex items-center gap-2">
                <Play className="h-3 w-3" />
                <TranslatableText text="Play Once" />
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Info */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Info className="h-3 w-3" />
        <span>
          <TranslatableText text="Seamless binaural beat transitions for enhanced focus" />
        </span>
      </div>
    </div>
  );
}