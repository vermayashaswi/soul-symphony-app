import { useState, useEffect, useCallback } from 'react';
import { binauralMusicService } from '@/services/binauralMusicService';
import { MusicCategory, MusicPlayerState } from '@/types/music';

const VOLUME_STORAGE_KEY = 'soul-symphony-music-volume';
const LAST_CATEGORY_STORAGE_KEY = 'soul-symphony-last-category';

export function useMusicPlayer() {
  const [state, setState] = useState<MusicPlayerState>({
    isPlaying: false,
    currentCategory: null,
    volume: 0.3,
    isDropdownOpen: false
  });

  // Load saved preferences
  useEffect(() => {
    const savedVolume = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (savedVolume) {
      const volume = parseFloat(savedVolume);
      setState(prev => ({ ...prev, volume }));
      binauralMusicService.setVolume(volume);
    }
  }, []);

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
            // This will be handled by category selection
            setState(prev => ({ ...prev, isDropdownOpen: true }));
            return;
          }
        }
        setState(prev => ({ ...prev, isPlaying: true }));
      }
    } catch (error) {
      console.error('[useMusicPlayer] Error toggling play:', error);
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
      console.error('[useMusicPlayer] Error selecting category:', error);
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    binauralMusicService.setVolume(clampedVolume);
    localStorage.setItem(VOLUME_STORAGE_KEY, clampedVolume.toString());
    setState(prev => ({ ...prev, volume: clampedVolume }));
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
  }, []);

  const closeDropdown = useCallback(() => {
    setState(prev => ({ ...prev, isDropdownOpen: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      binauralMusicService.dispose();
    };
  }, []);

  return {
    ...state,
    togglePlay,
    selectCategory,
    setVolume,
    stop,
    toggleDropdown,
    closeDropdown,
    getCurrentTrackInfo: () => binauralMusicService.getCurrentTrackInfo()
  };
}