
import { useState, useRef, useEffect, useCallback } from 'react';

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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // Clean up function
  const cleanup = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }, [audioUrl]);

  // Clean up on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Reset state when audio blob changes
  useEffect(() => {
    cleanup();
    
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      // Reset playback state
      setIsPlaying(false);
      setPlaybackProgress(0);
      
      if ('duration' in audioBlob && typeof (audioBlob as any).duration === 'number') {
        setAudioDuration((audioBlob as any).duration);
      } else {
        // We'll get the duration when metadata loads
        setAudioDuration(0);
      }
    } else {
      setAudioUrl(null);
      setAudioDuration(0);
    }
  }, [audioBlob, cleanup]);

  // Prepare audio when blob is available
  const prepareAudio = useCallback(async (): Promise<number> => {
    if (!audioBlob) return 0;
    
    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    
    const audio = audioRef.current;
    
    // If we already have a URL, use it, otherwise create a new one
    if (!audioUrl) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      audio.src = url;
    } else {
      audio.src = audioUrl;
    }
    
    // Set up audio element
    audio.preload = 'metadata';
    
    // Get duration from audio element
    return new Promise<number>((resolve) => {
      // First check if duration is already set on the blob
      if ('duration' in audioBlob && typeof (audioBlob as any).duration === 'number') {
        const duration = (audioBlob as any).duration;
        setAudioDuration(duration);
        resolve(duration);
        return;
      }
      
      // If metadata is already loaded
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setAudioDuration(audio.duration);
        resolve(audio.duration);
        return;
      }
      
      // Wait for metadata to load
      const handleLoadedMetadata = () => {
        const duration = audio.duration;
        setAudioDuration(duration);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('error', handleError);
        resolve(isNaN(duration) || duration === Infinity ? 0 : duration);
      };
      
      const handleError = () => {
        console.warn('Error loading audio metadata');
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('error', handleError);
        resolve(0);
      };
      
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('error', handleError);
      
      // Set a timeout in case metadata never loads
      const timeout = setTimeout(() => {
        console.warn('Timeout getting audio duration');
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('error', handleError);
        
        // Try to estimate duration from blob size
        let estimatedDuration = 0;
        if (audioBlob.size > 0) {
          // Rough estimation: ~128kbps
          estimatedDuration = audioBlob.size / 16000;
        }
        
        setAudioDuration(estimatedDuration);
        resolve(estimatedDuration);
      }, 2000);
      
      // Clear timeout if metadata loads
      audio.addEventListener('loadedmetadata', () => clearTimeout(timeout));
      audio.addEventListener('error', () => clearTimeout(timeout));
    });
  }, [audioBlob, audioUrl]);

  // Toggle playback
  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlaying) {
      // Pause playback
      audioRef.current.pause();
      setIsPlaying(false);
      
      // Clear progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    } else {
      // Start playback
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            
            if (onPlaybackStart) {
              onPlaybackStart();
            }
            
            // Set up progress interval
            progressIntervalRef.current = window.setInterval(() => {
              if (audioRef.current && audioDuration > 0) {
                const progress = audioRef.current.currentTime / audioDuration;
                setPlaybackProgress(progress);
                
                // Check if playback has ended
                if (audioRef.current.ended || audioRef.current.currentTime >= audioDuration) {
                  setIsPlaying(false);
                  setPlaybackProgress(0);
                  audioRef.current.currentTime = 0;
                  
                  if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                    progressIntervalRef.current = null;
                  }
                  
                  if (onPlaybackEnd) {
                    onPlaybackEnd();
                  }
                }
              }
            }, 50);
          })
          .catch(error => {
            console.error('Error playing audio:', error);
            setIsPlaying(false);
          });
      }
    }
  }, [isPlaying, audioUrl, audioDuration, onPlaybackStart, onPlaybackEnd]);

  // Seek to position
  const seekTo = useCallback((position: number) => {
    if (!audioRef.current) return;
    
    // Ensure position is between 0 and 1
    const clampedPosition = Math.max(0, Math.min(1, position));
    
    // Set current time
    audioRef.current.currentTime = clampedPosition * audioDuration;
    
    // Update progress
    setPlaybackProgress(clampedPosition);
  }, [audioDuration]);

  // Reset playback
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

  // Set up audio ended event
  useEffect(() => {
    const audio = audioRef.current;
    
    if (!audio) return;
    
    const handleEnded = () => {
      setIsPlaying(false);
      setPlaybackProgress(0);
      
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      if (onPlaybackEnd) {
        onPlaybackEnd();
      }
    };
    
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onPlaybackEnd]);

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
