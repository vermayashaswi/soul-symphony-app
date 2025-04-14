
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
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Clean up function to reset all state
  const reset = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Remove event listeners to prevent memory leaks
      const audio = audioRef.current;
      audio.onplay = null;
      audio.onpause = null;
      audio.onended = null;
      audio.ontimeupdate = null;
      audio.onerror = null;
      audio.onloadedmetadata = null;
    }
    
    setIsPlaying(false);
    setPlaybackProgress(0);
    setHasError(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Revoke any existing object URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  // Update progress in animation frame for smoother UI
  const updateProgress = useCallback(() => {
    if (audioRef.current && !isNaN(audioRef.current.duration) && audioRef.current.duration > 0) {
      const currentTime = audioRef.current.currentTime;
      const duration = audioRef.current.duration;
      
      // Calculate progress ratio (0 to 1)
      const progress = Math.min(1, Math.max(0, currentTime / duration));
      setPlaybackProgress(progress);
      
      // Continue updating if still playing
      if (!audioRef.current.paused) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    }
  }, []);

  // Toggle playback with additional error handling
  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioBlob) {
      console.error('No audio available for playback');
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    } else {
      // Ensure audio element is ready for playback
      if (audioRef.current.readyState < 2) {
        console.log('Audio not ready for playback, loading...');
        setIsLoading(true);
        
        // Reload the audio source if needed
        if (!audioRef.current.src || audioRef.current.src === '') {
          prepareAudio().then(() => {
            attemptPlayback();
          });
        } else {
          attemptPlayback();
        }
      } else {
        attemptPlayback();
      }
    }
  }, [isPlaying, audioBlob]);

  // Helper function to attempt playback with error handling
  const attemptPlayback = useCallback(() => {
    if (!audioRef.current) return;
    
    setIsLoading(true);
    
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('Playback started successfully');
          setIsPlaying(true);
          setIsLoading(false);
          setHasError(false);
          
          if (onPlaybackStart) onPlaybackStart();
          
          // Start progress tracking
          animationFrameRef.current = requestAnimationFrame(updateProgress);
        })
        .catch(err => {
          console.error('Error starting playback:', err);
          setIsPlaying(false);
          setIsLoading(false);
          setHasError(true);
          
          // Auto-retry once with user interaction for iOS browsers
          const handleUserInteraction = () => {
            if (!audioRef.current) return;
            
            const retry = audioRef.current.play();
            if (retry !== undefined) {
              retry
                .then(() => {
                  setIsPlaying(true);
                  setHasError(false);
                  if (onPlaybackStart) onPlaybackStart();
                  animationFrameRef.current = requestAnimationFrame(updateProgress);
                })
                .catch(e => {
                  console.error('Retry failed:', e);
                });
            }
            
            // Clean up listeners 
            document.removeEventListener('touchend', handleUserInteraction);
            document.removeEventListener('click', handleUserInteraction);
          };
          
          document.addEventListener('touchend', handleUserInteraction, { once: true });
          document.addEventListener('click', handleUserInteraction, { once: true });
        });
    }
  }, [onPlaybackStart, updateProgress]);

  // Seek to position in audio
  const seekTo = useCallback((position: number) => {
    if (!audioRef.current || position < 0 || position > 1) return;
    
    const newTime = position * (audioRef.current.duration || 0);
    
    try {
      audioRef.current.currentTime = newTime;
      setPlaybackProgress(position);
      
      // Force UI update immediately
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } catch (err) {
      console.error('Error seeking audio:', err);
    }
  }, [updateProgress]);

  // Prepare audio for playback
  const prepareAudio = useCallback(() => {
    return new Promise<number>((resolve) => {
      reset();
      
      if (!audioBlob) {
        setAudioDuration(0);
        resolve(0);
        return;
      }
      
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      
      setIsLoading(true);
      setHasError(false);
      
      // Revoke any existing object URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      
      // Create a new object URL
      const objectUrl = URL.createObjectURL(audioBlob);
      objectUrlRef.current = objectUrl;
      
      const audio = audioRef.current;
      
      // Set up event listeners
      const loadHandler = () => {
        console.log(`Audio loaded: duration=${audio.duration}s, type=${audioBlob.type}`);
        
        const duration = isNaN(audio.duration) || !isFinite(audio.duration) 
          ? 0.1 // Fallback duration
          : audio.duration;
            
        setAudioDuration(duration);
        setIsLoading(false);
        
        // Preload audio data
        audio.load();
        resolve(duration);
      };
      
      const errorHandler = (e: ErrorEvent | Event) => {
        console.error('Error loading audio:', e);
        setHasError(true);
        setIsLoading(false);
        setAudioDuration(0);
        resolve(0);
      };
      
      // Add event listeners
      audio.onloadedmetadata = loadHandler;
      audio.onerror = errorHandler as EventListener;
      
      // Set preload attribute for better performance
      audio.preload = 'metadata';
      audio.src = objectUrl;
      
      // Safety timeout in case metadata never loads
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.warn('Audio metadata loading timed out, using fallback');
          setAudioDuration(0.1); // Set minimal duration
          setIsLoading(false);
          resolve(0.1);
        }
      }, 3000);
      
      // Handle cleanup
      return () => {
        clearTimeout(timeout);
        audio.onloadedmetadata = null;
        audio.onerror = null;
      };
    });
  }, [audioBlob, reset, isLoading]);

  // Set up event handling for audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'metadata';
    }
    
    const audio = audioRef.current;
    
    // Create event handlers
    const handleEnded = () => {
      setIsPlaying(false);
      setPlaybackProgress(0);
      
      if (audio) {
        audio.currentTime = 0;
      }
      
      if (onPlaybackEnd) onPlaybackEnd();
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
    
    // Time update fallback in case requestAnimationFrame doesn't work
    const handleTimeUpdate = () => {
      if (audio && !isNaN(audio.duration) && audio.duration > 0) {
        const progress = audio.currentTime / audio.duration;
        setPlaybackProgress(progress);
      }
    };
    
    // Attach event listeners
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      // Remove event listeners on cleanup
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [onPlaybackEnd]);

  // Initialize or update audio source when blob changes
  useEffect(() => {
    if (audioBlob) {
      console.log(`New audio blob received: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
      prepareAudio();
    } else {
      reset();
    }
    
    return () => {
      reset();
    };
  }, [audioBlob, prepareAudio, reset]);

  return {
    isPlaying,
    playbackProgress,
    audioDuration,
    isLoading,
    hasError,
    togglePlayback,
    audioRef,
    reset,
    seekTo,
    prepareAudio
  };
}

export default useAudioPlayback;
