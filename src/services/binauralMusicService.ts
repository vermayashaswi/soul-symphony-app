import { MusicCategory, BinauralSettings } from '@/types/music';

export class BinauralMusicService {
  private audioContext: AudioContext | null = null;
  private leftOscillator: OscillatorNode | null = null;
  private rightOscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private currentCategory: MusicCategory | null = null;
  private currentTrackIndex = 0;

  async initialize(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('[BinauralMusicService] Audio context initialized');
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
  }

  private async playCurrentTrack(): Promise<void> {
    if (!this.currentCategory || !this.audioContext) return;

    // Stop any currently playing audio
    this.stopAudio();

    const settings = this.currentCategory.frequencies[this.currentTrackIndex];
    console.log(`[BinauralMusicService] Playing ${this.currentCategory.name} - Track ${this.currentTrackIndex + 1}`);

    // Create oscillators for left and right channels
    this.leftOscillator = this.audioContext.createOscillator();
    this.rightOscillator = this.audioContext.createOscillator();
    this.gainNode = this.audioContext.createGain();

    // Create channel splitter and merger for stereo effect
    const splitter = this.audioContext.createChannelSplitter(2);
    const merger = this.audioContext.createChannelMerger(2);

    // Configure left channel (base frequency)
    this.leftOscillator.frequency.setValueAtTime(settings.baseFrequency, this.audioContext.currentTime);
    this.leftOscillator.type = 'sine';

    // Configure right channel (base + binaural beat)
    this.rightOscillator.frequency.setValueAtTime(
      settings.baseFrequency + settings.binauralBeat,
      this.audioContext.currentTime
    );
    this.rightOscillator.type = 'sine';

    // Set volume
    this.gainNode.gain.setValueAtTime(0.8, this.audioContext.currentTime);

    // Connect audio nodes
    this.leftOscillator.connect(splitter);
    this.rightOscillator.connect(splitter);
    splitter.connect(merger, 0, 0); // Left channel
    splitter.connect(merger, 1, 1); // Right channel
    merger.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    // Start oscillators
    this.leftOscillator.start();
    this.rightOscillator.start();

    this.isPlaying = true;

    // Schedule next track
    setTimeout(() => {
      if (this.isPlaying && this.currentCategory) {
        this.nextTrack();
      }
    }, settings.duration * 1000);
  }

  private nextTrack(): void {
    if (!this.currentCategory) return;

    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.currentCategory.frequencies.length;
    this.playCurrentTrack();
  }

  pause(): void {
    this.stopAudio();
    this.isPlaying = false;
    console.log('[BinauralMusicService] Paused');
  }

  resume(): void {
    if (this.currentCategory) {
      this.playCurrentTrack();
    }
  }

  stop(): void {
    this.stopAudio();
    this.isPlaying = false;
    this.currentCategory = null;
    this.currentTrackIndex = 0;
    console.log('[BinauralMusicService] Stopped');
  }

  private stopAudio(): void {
    if (this.leftOscillator) {
      this.leftOscillator.stop();
      this.leftOscillator.disconnect();
      this.leftOscillator = null;
    }

    if (this.rightOscillator) {
      this.rightOscillator.stop();
      this.rightOscillator.disconnect();
      this.rightOscillator = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      // Clamp volume between 0 and 1
      const clampedVolume = Math.max(0, Math.min(1, volume));
      this.gainNode.gain.setValueAtTime(clampedVolume, this.audioContext!.currentTime);
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

    return {
      name: `${this.currentCategory.name} ${this.currentTrackIndex + 1}`,
      index: this.currentTrackIndex,
      total: this.currentCategory.frequencies.length
    };
  }

  // Clean up resources
  dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const binauralMusicService = new BinauralMusicService();