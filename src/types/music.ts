export interface BinauralSettings {
  baseFrequency: number; // Base frequency in Hz
  binauralBeat: number;   // Binaural beat frequency difference in Hz
  duration: number;       // Track duration in seconds
  name: string;          // Track name
}

export interface MusicCategory {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  color: string; // Theme color
  frequencies: BinauralSettings[];
}

export type PlaybackMode = 'loop' | 'single' | 'once';

export interface MusicPlayerState {
  isPlaying: boolean;
  currentCategory: MusicCategory | null;
  volume: number;
  isDropdownOpen: boolean;
  playbackMode: PlaybackMode;
  currentTrackIndex: number;
  trackProgress: number; // 0-1
  categoryProgress: number; // 0-1
}