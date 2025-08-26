import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Moon, Heart, Brain, Leaf, Palette, Zap, Shield, Target, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useTutorial } from '@/contexts/TutorialContext';
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

  const { isActive } = useTutorial();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Enhanced click-outside detection for portal rendering
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && 
          buttonRef.current && 
          !dropdownRef.current.contains(event.target as Node) &&
          !buttonRef.current.contains(event.target as Node)) {
        console.log('[MusicIconButton] Closing dropdown due to outside click');
        closeDropdown();
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [closeDropdown, isDropdownOpen]);

  const trackInfo = getCurrentTrackInfo();

  // Calculate dropdown position based on button position
  const getDropdownPosition = () => {
    if (!buttonRef.current) return { top: 60, right: 16 };
    
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right
    };
  };

  // Render dropdown using portal to escape stacking contexts
  const renderDropdown = () => {
    if (!isDropdownOpen) return null;

    const position = getDropdownPosition();
    const zIndex = isActive ? 999999 : 50000; // Ultra-high z-index during tutorial

    console.log('[MusicIconButton] Rendering dropdown with z-index:', zIndex);

    return createPortal(
      <AnimatePresence>
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            top: position.top,
            right: position.right,
            zIndex,
            width: 256,
            backgroundColor: 'hsl(var(--background))',
            backdropFilter: 'blur(12px)',
            border: '1px solid hsl(var(--border) / 0.5)',
            borderRadius: '8px',
            boxShadow: '0 10px 50px -10px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}
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
      </AnimatePresence>,
      document.body
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Music Icon Button */}
      <Button
        ref={buttonRef}
        onClick={isPlaying ? togglePlay : toggleDropdown}
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 hover:bg-primary/5 shadow-[0_0_8px_rgba(59,130,246,0.4)] hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-shadow duration-200"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Play className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>


      {/* Portal-rendered dropdown */}
      {renderDropdown()}
    </div>
  );
};

export default MusicIconButton;