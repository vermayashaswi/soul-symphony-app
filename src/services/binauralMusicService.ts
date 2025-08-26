import { MusicCategory, BinauralSettings, PlaybackMode } from '@/types/music';

export class BinauralMusicService {
  private audioContext: AudioContext | null = null;
  private leftOscillator: OscillatorNode | null = null;
  private rightOscillator: OscillatorNode | null = null;
  private nextLeftOscillator: OscillatorNode | null = null;
  private nextRightOscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private nextGainNode: GainNode | null = null;
  private isPlaying = false;
  private currentCategory: MusicCategory | null = null;
  private currentTrackIndex = 0;
  private playbackMode: PlaybackMode = 'loop';
  private trackStartTime = 0;
  private currentTrackDuration = 0;
  private progressCallback: ((trackProgress: number, categoryProgress: number) => void) | null = null;
  private animationFrameId: number | null = null;
  private isTransitioning = false;
  private nextTrackTimeout: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume context if suspended (common on mobile)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      console.log('[BinauralMusicService] Audio context initialized:', this.audioContext.state);
    } catch (error) {
      console.error('[BinauralMusicService] Failed to initialize audio context:', error);
      throw error;
    }
  }

  async startCategory(category: MusicCategory): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }

    if (this.audioContext!.state === 'suspended') {
      await this.audioContext!.resume();
    }

    this.currentCategory = category;
    this.currentTrackIndex = 0;
    await this.playCurrentTrack();
    this.startProgressTracking();
  }

  private async playCurrentTrack(): Promise<void> {
    if (!this.currentCategory || !this.audioContext || this.isTransitioning) return;

    const settings = this.currentCategory.frequencies[this.currentTrackIndex];
    console.log(`[BinauralMusicService] Playing ${this.currentCategory.name} - ${settings.name} (${this.currentTrackIndex + 1}/${this.currentCategory.frequencies.length})`);

    try {
      // Clamp frequencies to safe ranges
      const baseFreq = Math.max(40, Math.min(2000, settings.baseFrequency));
      const binauralBeat = Math.max(1, Math.min(40, settings.binauralBeat));
      
      if (baseFreq !== settings.baseFrequency || binauralBeat !== settings.binauralBeat) {
        console.warn('[BinauralMusicService] Frequencies clamped to safe ranges');
      }

      if (!this.isTransitioning) {
        // Clean stop for non-transitioning tracks
        this.cleanStopAudio();
      }

      // Create new audio nodes
      this.leftOscillator = this.audioContext.createOscillator();
      this.rightOscillator = this.audioContext.createOscillator();
      this.gainNode = this.audioContext.createGain();

      // Create channel-specific nodes
      const leftGain = this.audioContext.createGain();
      const rightGain = this.audioContext.createGain();
      const leftPanner = this.audioContext.createStereoPanner();
      const rightPanner = this.audioContext.createStereoPanner();

      // Configure oscillators with precise timing
      const startTime = this.audioContext.currentTime + 0.01; // Small delay for setup
      
      this.leftOscillator.frequency.setValueAtTime(baseFreq, startTime);
      this.leftOscillator.type = 'sine';
      this.rightOscillator.frequency.setValueAtTime(baseFreq + binauralBeat, startTime);
      this.rightOscillator.type = 'sine';

      // Configure stereo separation
      leftPanner.pan.setValueAtTime(-0.8, startTime); // Slight left bias
      rightPanner.pan.setValueAtTime(0.8, startTime); // Slight right bias

      // Set individual volumes to prevent clipping
      leftGain.gain.setValueAtTime(0.25, startTime);
      rightGain.gain.setValueAtTime(0.25, startTime);

      // Master volume with smooth fade-in
      this.gainNode.gain.setValueAtTime(0.001, startTime);
      this.gainNode.gain.exponentialRampToValueAtTime(1, startTime + 0.5);

      // Connect audio graph
      this.leftOscillator.connect(leftGain);
      leftGain.connect(leftPanner);
      leftPanner.connect(this.gainNode);

      this.rightOscillator.connect(rightGain);
      rightGain.connect(rightPanner);
      rightPanner.connect(this.gainNode);

      this.gainNode.connect(this.audioContext.destination);

      // Start oscillators with precise timing
      this.leftOscillator.start(startTime);
      this.rightOscillator.start(startTime);

      // Track timing
      this.trackStartTime = this.audioContext.currentTime;
      this.currentTrackDuration = settings.duration;
      this.isPlaying = true;
      this.isTransitioning = false;

      // Clear any existing timeout
      if (this.nextTrackTimeout) {
        clearTimeout(this.nextTrackTimeout);
      }

      // Schedule seamless transition
      this.nextTrackTimeout = setTimeout(() => {
        if (this.isPlaying && this.currentCategory) {
          this.performSeamlessTransition();
        }
      }, (settings.duration - 2) * 1000); // Start transition 2s before end

    } catch (error) {
      console.error('[BinauralMusicService] Error creating audio nodes:', error);
      this.isPlaying = false;
      this.isTransitioning = false;
    }
  }

  private async performSeamlessTransition(): Promise<void> {
    if (!this.currentCategory || !this.audioContext || this.isTransitioning) return;
    
    this.isTransitioning = true;
    
    try {
      // Determine next track based on playback mode
      const nextIndex = this.getNextTrackIndex();
      
      if (nextIndex === -1) {
        // End of playback in 'once' mode
        this.stop();
        return;
      }

      const nextSettings = this.currentCategory.frequencies[nextIndex];
      const baseFreq = Math.max(40, Math.min(2000, nextSettings.baseFrequency));
      const binauralBeat = Math.max(1, Math.min(40, nextSettings.binauralBeat));

      // Create next track's audio nodes
      this.nextLeftOscillator = this.audioContext.createOscillator();
      this.nextRightOscillator = this.audioContext.createOscillator();
      this.nextGainNode = this.audioContext.createGain();

      const nextLeftGain = this.audioContext.createGain();
      const nextRightGain = this.audioContext.createGain();
      const nextLeftPanner = this.audioContext.createStereoPanner();
      const nextRightPanner = this.audioContext.createStereoPanner();

      // Configure next track
      const transitionTime = this.audioContext.currentTime;
      const crossfadeDuration = 1.5; // 1.5 second crossfade

      this.nextLeftOscillator.frequency.setValueAtTime(baseFreq, transitionTime);
      this.nextLeftOscillator.type = 'sine';
      this.nextRightOscillator.frequency.setValueAtTime(baseFreq + binauralBeat, transitionTime);
      this.nextRightOscillator.type = 'sine';

      nextLeftPanner.pan.setValueAtTime(-0.8, transitionTime);
      nextRightPanner.pan.setValueAtTime(0.8, transitionTime);
      nextLeftGain.gain.setValueAtTime(0.25, transitionTime);
      nextRightGain.gain.setValueAtTime(0.25, transitionTime);

      // Start next track at zero volume
      this.nextGainNode.gain.setValueAtTime(0.001, transitionTime);

      // Connect next track
      this.nextLeftOscillator.connect(nextLeftGain);
      nextLeftGain.connect(nextLeftPanner);
      nextLeftPanner.connect(this.nextGainNode);
      this.nextRightOscillator.connect(nextRightGain);
      nextRightGain.connect(nextRightPanner);
      nextRightPanner.connect(this.nextGainNode);
      this.nextGainNode.connect(this.audioContext.destination);

      // Start next oscillators
      this.nextLeftOscillator.start(transitionTime);
      this.nextRightOscillator.start(transitionTime);

      // Crossfade: fade out current, fade in next
      if (this.gainNode) {
        this.gainNode.gain.exponentialRampToValueAtTime(0.001, transitionTime + crossfadeDuration);
      }
      this.nextGainNode.gain.exponentialRampToValueAtTime(1, transitionTime + crossfadeDuration);

      // Switch to next track after crossfade
      setTimeout(() => {
        this.cleanStopAudio();
        
        // Move next track to current
        this.leftOscillator = this.nextLeftOscillator;
        this.rightOscillator = this.nextRightOscillator;
        this.gainNode = this.nextGainNode;
        
        this.nextLeftOscillator = null;
        this.nextRightOscillator = null;
        this.nextGainNode = null;
        
        this.currentTrackIndex = nextIndex;
        this.trackStartTime = this.audioContext!.currentTime;
        this.currentTrackDuration = nextSettings.duration;
        
        // Schedule next transition
        if (this.nextTrackTimeout) {
          clearTimeout(this.nextTrackTimeout);
        }
        
        this.nextTrackTimeout = setTimeout(() => {
          if (this.isPlaying && this.currentCategory) {
            this.performSeamlessTransition();
          }
        }, (nextSettings.duration - 2) * 1000);
        
        this.isTransitioning = false;
        
      }, crossfadeDuration * 1000 + 100);

    } catch (error) {
      console.error('[BinauralMusicService] Error during transition:', error);
      this.isTransitioning = false;
      // Fallback to regular track change
      this.nextTrack();
    }
  }

  private getNextTrackIndex(): number {
    if (!this.currentCategory) return -1;
    
    switch (this.playbackMode) {
      case 'single':
        return this.currentTrackIndex; // Repeat current track
      case 'once':
        const nextIndex = this.currentTrackIndex + 1;
        if (nextIndex >= this.currentCategory.frequencies.length) {
          return -1; // End playback
        }
        return nextIndex;
      case 'loop':
      default:
        return (this.currentTrackIndex + 1) % this.currentCategory.frequencies.length;
    }
  }

  private nextTrack(): void {
    if (!this.currentCategory) return;
    
    const nextIndex = this.getNextTrackIndex();
    if (nextIndex === -1) {
      this.stop();
      return;
    }
    
    this.currentTrackIndex = nextIndex;
    this.playCurrentTrack();
  }

  pause(): void {
    if (this.nextTrackTimeout) {
      clearTimeout(this.nextTrackTimeout);
      this.nextTrackTimeout = null;
    }
    this.stopProgressTracking();
    this.cleanStopAudio();
    this.isPlaying = false;
    console.log('[BinauralMusicService] Paused');
  }

  resume(): void {
    if (this.currentCategory) {
      this.playCurrentTrack();
      this.startProgressTracking();
    }
  }

  stop(): void {
    if (this.nextTrackTimeout) {
      clearTimeout(this.nextTrackTimeout);
      this.nextTrackTimeout = null;
    }
    this.stopProgressTracking();
    this.cleanStopAudio();
    this.isPlaying = false;
    this.currentCategory = null;
    this.currentTrackIndex = 0;
    this.isTransitioning = false;
    console.log('[BinauralMusicService] Stopped');
  }

  private cleanStopAudio(): void {
    try {
      // Stop current oscillators with proper timing
      if (this.leftOscillator) {
        const stopTime = this.audioContext?.currentTime || 0;
        this.leftOscillator.stop(stopTime + 0.01);
        this.leftOscillator.disconnect();
        this.leftOscillator = null;
      }

      if (this.rightOscillator) {
        const stopTime = this.audioContext?.currentTime || 0;
        this.rightOscillator.stop(stopTime + 0.01);
        this.rightOscillator.disconnect();
        this.rightOscillator = null;
      }

      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }

      // Clean up next track nodes if they exist
      if (this.nextLeftOscillator) {
        const stopTime = this.audioContext?.currentTime || 0;
        this.nextLeftOscillator.stop(stopTime + 0.01);
        this.nextLeftOscillator.disconnect();
        this.nextLeftOscillator = null;
      }

      if (this.nextRightOscillator) {
        const stopTime = this.audioContext?.currentTime || 0;
        this.nextRightOscillator.stop(stopTime + 0.01);
        this.nextRightOscillator.disconnect();
        this.nextRightOscillator = null;
      }

      if (this.nextGainNode) {
        this.nextGainNode.disconnect();
        this.nextGainNode = null;
      }
    } catch (error) {
      console.warn('[BinauralMusicService] Error during audio cleanup:', error);
    }
  }

  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(clampedVolume, this.audioContext.currentTime);
    }
    if (this.nextGainNode && this.audioContext) {
      this.nextGainNode.gain.setValueAtTime(clampedVolume, this.audioContext.currentTime);
    }
  }

  setPlaybackMode(mode: PlaybackMode): void {
    this.playbackMode = mode;
    console.log('[BinauralMusicService] Playback mode set to:', mode);
  }

  getPlaybackMode(): PlaybackMode {
    return this.playbackMode;
  }

  previousTrack(): void {
    if (!this.currentCategory) return;
    
    if (this.nextTrackTimeout) {
      clearTimeout(this.nextTrackTimeout);
      this.nextTrackTimeout = null;
    }
    
    this.currentTrackIndex = this.currentTrackIndex === 0 
      ? this.currentCategory.frequencies.length - 1 
      : this.currentTrackIndex - 1;
    
    this.playCurrentTrack();
  }

  skipToNextTrack(): void {
    if (!this.currentCategory) return;
    
    if (this.nextTrackTimeout) {
      clearTimeout(this.nextTrackTimeout);
      this.nextTrackTimeout = null;
    }
    
    const nextIndex = this.getNextTrackIndex();
    if (nextIndex === -1) {
      this.stop();
      return;
    }
    
    this.currentTrackIndex = nextIndex;
    this.playCurrentTrack();
  }

  setProgressCallback(callback: (trackProgress: number, categoryProgress: number) => void): void {
    this.progressCallback = callback;
  }

  private startProgressTracking(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    const updateProgress = () => {
      if (!this.isPlaying || !this.audioContext || !this.currentCategory) {
        return;
      }
      
      const elapsed = this.audioContext.currentTime - this.trackStartTime;
      const trackProgress = Math.min(elapsed / this.currentTrackDuration, 1);
      const categoryProgress = (this.currentTrackIndex + trackProgress) / this.currentCategory.frequencies.length;
      
      if (this.progressCallback) {
        this.progressCallback(trackProgress, categoryProgress);
      }
      
      this.animationFrameId = requestAnimationFrame(updateProgress);
    };
    
    updateProgress();
  }

  private stopProgressTracking(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getCurrentCategory(): MusicCategory | null {
    return this.currentCategory;
  }

  getCurrentTrackInfo(): { name: string; index: number; total: number } | null {
    if (!this.currentCategory) return null;

    const currentTrack = this.currentCategory.frequencies[this.currentTrackIndex];
    return {
      name: currentTrack.name,
      index: this.currentTrackIndex,
      total: this.currentCategory.frequencies.length
    };
  }

  // Clean up resources
  dispose(): void {
    if (this.nextTrackTimeout) {
      clearTimeout(this.nextTrackTimeout);
      this.nextTrackTimeout = null;
    }
    this.stopProgressTracking();
    this.stop();
    this.progressCallback = null;
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const binauralMusicService = new BinauralMusicService();