import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { binauralMusicService } from '@/services/binauralMusicService';
import { MusicCategory, MusicPlayerState } from '@/types/music';

const VOLUME_STORAGE_KEY = 'soul-symphony-music-volume';
const LAST_CATEGORY_STORAGE_KEY = 'soul-symphony-last-category';

interface MusicPlayerContextType extends MusicPlayerState {
  togglePlay: () => Promise<void>;
  selectCategory: (category: MusicCategory) => Promise<void>;
  stop: () => void;
  toggleDropdown: () => void;
  closeDropdown: () => void;
  getCurrentTrackInfo: () => { name: string; index: number; total: number } | null;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (context === undefined) {
    throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
  }
  return context;
}

interface MusicPlayerProviderProps {
  children: ReactNode;
}

export function MusicPlayerProvider({ children }: MusicPlayerProviderProps) {
  const [state, setState] = useState<MusicPlayerState>({
    isPlaying: false,
    currentCategory: null,
    volume: 0.8,
    isDropdownOpen: false
  });


  const togglePlay = useCallback(async () => {
    try {
      if (state.isPlaying) {
        binauralMusicService.pause();
        setState(prev => ({ ...prev, isPlaying: false }));
      } else {
        if (state.currentCategory) {
          binauralMusicService.resume();
        } else {
          // Load last used category or default to focus
          const lastCategoryId = localStorage.getItem(LAST_CATEGORY_STORAGE_KEY);
          if (lastCategoryId) {
            setState(prev => ({ ...prev, isDropdownOpen: true }));
            return;
          }
        }
        setState(prev => ({ ...prev, isPlaying: true }));
      }
    } catch (error) {
      console.error('[MusicPlayerProvider] Error toggling play:', error);
    }
  }, [state.isPlaying, state.currentCategory]);

  const selectCategory = useCallback(async (category: MusicCategory) => {
    try {
      await binauralMusicService.startCategory(category);
      localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, category.id);
      setState(prev => ({
        ...prev,
        currentCategory: category,
        isPlaying: true,
        isDropdownOpen: false
      }));
    } catch (error) {
      console.error('[MusicPlayerProvider] Error selecting category:', error);
    }
  }, []);


  const stop = useCallback(() => {
    binauralMusicService.stop();
    setState(prev => ({
      ...prev,
      isPlaying: false,
      currentCategory: null
    }));
  }, []);

  const toggleDropdown = useCallback(() => {
    setState(prev => ({ ...prev, isDropdownOpen: !prev.isDropdownOpen }));
    // Close language selector when music dropdown opens
    if (!state.isDropdownOpen) {
      window.dispatchEvent(new CustomEvent('closeLangDropdown'));
    }
  }, [state.isDropdownOpen]);

  const closeDropdown = useCallback(() => {
    setState(prev => ({ ...prev, isDropdownOpen: false }));
  }, []);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      binauralMusicService.dispose();
    };
  }, []);

  const getCurrentTrackInfo = useCallback(() => {
    return binauralMusicService.getCurrentTrackInfo();
  }, []);

  const value: MusicPlayerContextType = {
    ...state,
    togglePlay,
    selectCategory,
    stop,
    toggleDropdown,
    closeDropdown,
    getCurrentTrackInfo
  };

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
    </MusicPlayerContext.Provider>
  );
}