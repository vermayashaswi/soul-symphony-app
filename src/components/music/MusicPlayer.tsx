import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, Moon, Heart, Brain, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useMusicPlayer } from '@/hooks/useMusicPlayer';
import { musicCategories } from '@/config/musicCategories';
import { MusicCategory } from '@/types/music';

const iconMap = {
  Moon,
  Heart, 
  Brain,
  Leaf
};

interface MusicPlayerProps {
  className?: string;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ className = "" }) => {
  const {
    isPlaying,
    currentCategory,
    volume,
    isDropdownOpen,
    togglePlay,
    selectCategory,
    setVolume,
    toggleDropdown,
    closeDropdown,
    getCurrentTrackInfo
  } = useMusicPlayer();

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown]);

  const trackInfo = getCurrentTrackInfo();

  return (
    <div className={`relative ${className}`}>
      {/* Main Play Button */}
      <div className="flex items-center gap-2">
        <Button
          onClick={isPlaying ? togglePlay : toggleDropdown}
          size="sm"
          variant="outline"
          className="h-10 px-3 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all duration-200"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 text-primary" />
          ) : (
            <Play className="h-4 w-4 text-primary" />
          )}
          <span className="ml-2 text-sm font-medium">
            {currentCategory ? currentCategory.name : 'Music'}
          </span>
        </Button>

        {/* Quick pause when playing */}
        {isPlaying && (
          <Button
            onClick={togglePlay}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 hover:bg-primary/5"
          >
            <Pause className="h-3 w-3 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Category Selection Dropdown */}
      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-12 left-0 z-50 w-64 bg-background/95 backdrop-blur-md border border-border/50 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="p-3 border-b border-border/30">
              <h3 className="text-sm font-semibold text-foreground">Choose Music Type</h3>
              <p className="text-xs text-muted-foreground mt-1">Binaural beats for different moods</p>
            </div>

            <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
              {musicCategories.map((category) => {
                const Icon = iconMap[category.icon as keyof typeof iconMap];
                return (
                  <Button
                    key={category.id}
                    onClick={() => selectCategory(category)}
                    variant="ghost"
                    className="w-full justify-start h-auto py-3 px-3 text-left hover:bg-primary/5"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: category.color }}
                      >
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground">{category.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{category.description}</div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>

            {/* Volume Control */}
            <div className="p-3 border-t border-border/30 bg-muted/20">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Slider
                  value={[volume]}
                  onValueChange={(values) => setVolume(values[0])}
                  max={1}
                  min={0}
                  step={0.1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-8 text-right">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Now Playing Indicator */}
      {isPlaying && trackInfo && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-xs text-muted-foreground"
        >
          Playing: {trackInfo.name} ({trackInfo.index + 1}/{trackInfo.total})
        </motion.div>
      )}
    </div>
  );
};

export default MusicPlayer;