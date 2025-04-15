
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioPlaybackProps {
  audioBlob: Blob | null;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
}

export function useAudioPlayback({ 
  audioBlob, 
  onPlaybackStart, 
  onPlaybackEnd 
}: UseAudioPlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedMetadata = useRef(false);

  // Clean up function to stop intervals and revoke URL
  const cleanup = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  // Effect to handle audio blob changes
  useEffect(() => {
    // Reset state when audio changes
    setIsPlaying(false);
    setPlaybackProgress(0);
    hasLoadedMetadata.current = false;
    
    // Clean up previous resources
    cleanup();
    
    // Return early if no blob or audio element
    if (!audioBlob || !audioRef.current) {
      setAudioDuration(0);
      return;
    }
    
    console.log('[useAudioPlayback] Creating new URL for audio blob');
    try {
      // Create and set new audio URL
      const url = URL.createObjectURL(audioBlob);
      audioUrlRef.current = url;
      audioRef.current.src = url;
      audioRef.current.load();
      
      // Check if blob has duration property we can use immediately
      if ('duration' in audioBlob && typeof (audioBlob as any).duration === 'number') {
        const blobDuration = (audioBlob as any).duration;
        console.log('[useAudioPlayback] Using duration from blob:', blobDuration);
        setAudioDuration(blobDuration);
      } else {
        console.log('[useAudioPlayback] No duration in blob, waiting for loadedmetadata event');
      }
    } catch (error) {
      console.error('[useAudioPlayback] Error setting up audio:', error);
    }
    
    return cleanup;
  }, [audioBlob, cleanup]);

  // Effect to handle audio element event listeners
  useEffect(() => {
    if (!audioRef.current) return;
    
    const audio = audioRef.current;
    
    const handleLoadedMetadata = () => {
      console.log('[useAudioPlayback] Audio metadata loaded, duration:', audio.duration);
      
      if (isFinite(audio.duration) && audio.duration > 0) {
        setAudioDuration(audio.duration);
        hasLoadedMetadata.current = true;
      } else {
        console.log('[useAudioPlayback] Invalid duration from metadata:', audio.duration);
        // Try to use duration from blob if metadata fails
        if (audioBlob && 'duration' in audioBlob && typeof (audioBlob as any).duration === 'number') {
          setAudioDuration((audioBlob as any).duration);
        }
      }
    };
    
    const handleTimeUpdate = () => {
      if (audio.duration > 0) {
        const progress = audio.currentTime / audio.duration;
        setPlaybackProgress(progress);
      }
    };
    
    const handleEnded = () => {
      console.log('[useAudioPlayback] Playback ended');
      setIsPlaying(false);
      setPlaybackProgress(1); // Ensure we show 100% complete
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (onPlaybackEnd) onPlaybackEnd();
    };
    
    const handleError = (e: ErrorEvent) => {
      console.error('[useAudioPlayback] Audio error:', e);
      setIsPlaying(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
    
    // Add event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError as EventListener);
    
    return () => {
      // Remove event listeners
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError as EventListener);
    };
  }, [audioBlob, onPlaybackEnd]);

  // Handle toggling playback
  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioBlob) return;
    
    const audio = audioRef.current;
    
    if (isPlaying) {
      console.log('[useAudioPlayback] Pausing playback');
      audio.pause();
      setIsPlaying(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    } else {
      console.log('[useAudioPlayback] Starting playback');
      
      // If we're at the end, restart from beginning
      if (audio.currentTime >= audio.duration - 0.1) {
        audio.currentTime = 0;
        setPlaybackProgress(0);
      }
      
      // Start playback
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            if (onPlaybackStart) onPlaybackStart();
            
            // Use an interval as a backup to update progress more smoothly
            // and in case timeupdate events are not firing frequently enough
            if (!progressIntervalRef.current) {
              progressIntervalRef.current = setInterval(() => {
                if (audio.duration > 0) {
                  const progress = audio.currentTime / audio.duration;
                  setPlaybackProgress(progress);
                }
              }, 50); // Update every 50ms for smoother progress
            }
          })
          .catch(error => {
            console.error('[useAudioPlayback] Error playing audio:', error);
          });
      }
    }
  }, [isPlaying, audioBlob, onPlaybackStart]);

  // Seek to a specific position in the audio
  const seekTo = useCallback((position: number) => {
    if (!audioRef.current || !audioBlob) return;
    
    try {
      const audio = audioRef.current;
      const newTime = position * audio.duration;
      
      console.log(`[useAudioPlayback] Seeking to position ${position} (${newTime}s)`);
      
      if (newTime >= 0 && newTime <= audio.duration) {
        audio.currentTime = newTime;
        setPlaybackProgress(position);
      }
    } catch (error) {
      console.error('[useAudioPlayback] Error seeking:', error);
    }
  }, [audioBlob]);

  // Prepare audio for playback (useful to ensure duration is loaded)
  const prepareAudio = useCallback(async (): Promise<number> => {
    return new Promise((resolve) => {
      if (!audioRef.current || !audioBlob) {
        resolve(0);
        return;
      }
      
      const audio = audioRef.current;
      
      if (hasLoadedMetadata.current && audioDuration > 0) {
        // Already loaded, return current duration
        resolve(audioDuration);
        return;
      }
      
      // Check if blob has duration property
      if (audioBlob && 'duration' in audioBlob && typeof (audioBlob as any).duration === 'number') {
        const blobDuration = (audioBlob as any).duration;
        console.log('[useAudioPlayback] Using duration from blob:', blobDuration);
        setAudioDuration(blobDuration);
        resolve(blobDuration);
        return;
      }
      
      // Try to load metadata if not already loaded
      const handleLoad = () => {
        console.log('[useAudioPlayback] Audio loaded, duration:', audio.duration);
        if (isFinite(audio.duration) && audio.duration > 0) {
          setAudioDuration(audio.duration);
          resolve(audio.duration);
        } else {
          // Fallback: estimate duration from blob size
          const estimatedDuration = audioBlob.size / 16000; // ~128kbps
          console.log('[useAudioPlayback] Using estimated duration:', estimatedDuration);
          setAudioDuration(estimatedDuration);
          resolve(estimatedDuration);
        }
        audio.removeEventListener('loadedmetadata', handleLoad);
      };
      
      const handleError = () => {
        console.error('[useAudioPlayback] Error loading audio metadata');
        // Fallback: estimate duration from blob size
        const estimatedDuration = audioBlob.size / 16000; // ~128kbps
        console.log('[useAudioPlayback] Using estimated duration after error:', estimatedDuration);
        setAudioDuration(estimatedDuration);
        resolve(estimatedDuration);
        audio.removeEventListener('loadedmetadata', handleLoad);
        audio.removeEventListener('error', handleError);
      };
      
      audio.addEventListener('loadedmetadata', handleLoad);
      audio.addEventListener('error', handleError);
      
      // Force load if needed
      if (!audio.src && audioUrlRef.current) {
        audio.src = audioUrlRef.current;
        audio.load();
      }
      
      // Add timeout in case events never fire
      setTimeout(() => {
        if (!hasLoadedMetadata.current) {
          audio.removeEventListener('loadedmetadata', handleLoad);
          audio.removeEventListener('error', handleError);
          
          // Fallback: estimate duration from blob size
          const estimatedDuration = audioBlob.size / 16000; // ~128kbps
          console.log('[useAudioPlayback] Timeout - using estimated duration:', estimatedDuration);
          setAudioDuration(estimatedDuration);
          resolve(estimatedDuration);
        }
      }, 3000);
    });
  }, [audioBlob, audioDuration]);

  // Reset playback state
  const reset = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    setIsPlaying(false);
    setPlaybackProgress(0);
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  return {
    isPlaying,
    playbackProgress,
    audioDuration,
    audioRef,
    togglePlayback,
    seekTo,
    reset,
    prepareAudio
  };
}
