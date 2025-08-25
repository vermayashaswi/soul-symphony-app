import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Moon, Heart, Brain, Leaf, Palette, Zap, Shield, Target, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { musicCategories } from '@/config/musicCategories';
import { TranslatableText } from '@/components/translation/TranslatableText';

const iconMap = {
  Moon,
  Heart, 
  Brain,
  Leaf,
  Palette,
  Zap,
  Shield,
  Target,
  Cloud
};

interface MusicIconButtonProps {
  className?: string;
}

const MusicIconButton: React.FC<MusicIconButtonProps> = ({ className = "" }) => {
  const {
    isPlaying,
    currentCategory,
    isDropdownOpen,
    togglePlay,
    selectCategory,
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
      {/* Music Icon Button */}
      <Button
        onClick={isPlaying ? togglePlay : toggleDropdown}
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 hover:bg-primary/5"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Play className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {/* Category Selection Dropdown */}
      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-10 right-0 z-[10000] w-64 bg-background/95 backdrop-blur-md border border-border/50 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="p-3 border-b border-border/30">
              <h3 className="text-sm font-semibold text-foreground">
                <TranslatableText text="Choose Music Type" />
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                <TranslatableText text="Binaural beats for different moods" />
              </p>
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
                        <div className="font-medium text-sm text-foreground">
                          <TranslatableText text={category.name} />
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default MusicIconButton;