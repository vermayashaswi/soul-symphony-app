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

export interface MusicPlayerState {
  isPlaying: boolean;
  currentCategory: MusicCategory | null;
  volume: number;
  isDropdownOpen: boolean;
}