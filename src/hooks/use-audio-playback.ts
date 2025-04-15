
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
  const playAttemptCountRef = useRef(0);
  const stableDurationRef = useRef<number>(1); // Start with a minimum of 1 second
  const audioReadyRef = useRef(false);

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
    playAttemptCountRef.current = 0;
    audioReadyRef.current = false;
    
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
      
      // Use stable duration reference to prevent flickering
      if (Math.abs(duration - stableDurationRef.current) > 0.5) {
        stableDurationRef.current = duration;
        setAudioDuration(duration);
      }
      
      // Calculate progress ratio (0 to 1)
      const progress = Math.min(1, Math.max(0, currentTime / stableDurationRef.current));
      setPlaybackProgress(progress);
      
      // Continue updating if still playing
      if (!audioRef.current.paused) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    }
  }, []);

  // Toggle playback with additional error handling
  const togglePlayback = useCallback(() => {
    if (!audioBlob) {
      console.error('[useAudioPlayback] No audio available for playback');
      return;
    }

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      }
    } else {
      // Ensure audio element is ready for playback
      if (!audioRef.current || audioRef.current.readyState < 2 || !audioReadyRef.current) {
        console.log('[useAudioPlayback] Audio not ready for playback, loading...');
        setIsLoading(true);
        
        // Force reload the audio source
        prepareAudio(true).then(() => {
          setTimeout(() => attemptPlayback(), 100); // Short delay to ensure audio is prepared
        });
      } else {
        attemptPlayback();
      }
    }
  }, [isPlaying, audioBlob]);

  // Helper function to attempt playback with error handling
  const attemptPlayback = useCallback(() => {
    if (!audioRef.current) {
      console.error('[useAudioPlayback] No audio element for playback');
      return;
    }
    
    setIsLoading(true);
    setHasError(false);
    playAttemptCountRef.current += 1;
    
    console.log(`[useAudioPlayback] Attempting playback (attempt ${playAttemptCountRef.current})`);
    
    // Force seek to beginning for consistent playback
    try {
      audioRef.current.currentTime = 0;
    } catch (err) {
      console.warn('[useAudioPlayback] Could not seek to beginning:', err);
    }
    
    // Set a minimum default duration to prevent flicker
    if (audioRef.current.duration <= 0 || isNaN(audioRef.current.duration)) {
      console.log('[useAudioPlayback] Using default duration of 1 second for empty audio');
      setAudioDuration(1);
      stableDurationRef.current = 1;
    }
    
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('[useAudioPlayback] Playback started successfully');
          setIsPlaying(true);
          setIsLoading(false);
          setHasError(false);
          
          if (onPlaybackStart) onPlaybackStart();
          
          // Start progress tracking
          animationFrameRef.current = requestAnimationFrame(updateProgress);
        })
        .catch(err => {
          console.error('[useAudioPlayback] Error starting playback:', err);
          setIsPlaying(false);
          setIsLoading(false);
          setHasError(true);
          
          // Retry with different approach for mobile browsers
          if (playAttemptCountRef.current < 3) {
            console.log('[useAudioPlayback] Trying fallback playback method');
            setTimeout(() => {
              if (!audioRef.current) return;
              
              // For mobile browsers: recreate the audio element entirely
              recreateAudioElement();
              
              setTimeout(() => {
                if (audioRef.current) {
                  console.log('[useAudioPlayback] Attempting play after recreation');
                  audioRef.current.play()
                    .then(() => {
                      setIsPlaying(true);
                      setHasError(false);
                      
                      if (onPlaybackStart) onPlaybackStart();
                      animationFrameRef.current = requestAnimationFrame(updateProgress);
                    })
                    .catch(e => {
                      console.error('[useAudioPlayback] Final playback attempt failed:', e);
                      setIsPlaying(false);
                      setIsLoading(false);
                      setHasError(true);
                    });
                }
              }, 200);
            }, 200);
          }
        });
    } else {
      console.error('[useAudioPlayback] Browser cannot fulfill play request');
      setIsPlaying(false);
      setIsLoading(false);
      setHasError(true);
    }
  }, [onPlaybackStart, updateProgress]);

  // Recreate audio element from scratch (last resort)
  const recreateAudioElement = useCallback(() => {
    console.log('[useAudioPlayback] Recreating audio element');
    
    // Clean up existing element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
    }
    
    // Create a fresh element
    const newAudio = new Audio();
    audioRef.current = newAudio;
    
    // Set up fresh event listeners
    setupAudioListeners();
    
    // Re-prepare the audio
    prepareAudio(true).then(() => {
      console.log('[useAudioPlayback] Audio element recreated and prepared');
    });
  }, []);

  // Seek to position in audio
  const seekTo = useCallback((position: number) => {
    if (!audioRef.current || position < 0 || position > 1) return;
    
    // Use stable duration to prevent flicker
    const newTime = position * stableDurationRef.current;
    
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

  // Set up audio element event listeners
  const setupAudioListeners = useCallback(() => {
    if (!audioRef.current) return;
    
    const audio = audioRef.current;
    
    // Create event handlers
    const handleEnded = () => {
      console.log('[useAudioPlayback] Playback ended');
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
        // Use stable duration to prevent flicker
        if (Math.abs(audio.duration - stableDurationRef.current) > 0.5) {
          stableDurationRef.current = audio.duration;
          setAudioDuration(audio.duration);
        }
        
        const progress = audio.currentTime / stableDurationRef.current;
        setPlaybackProgress(progress);
      }
    };
    
    // Error handler
    const handleError = (e: Event) => {
      console.error('[useAudioPlayback] Audio error:', e);
      console.error('[useAudioPlayback] Audio error code:', audio.error?.code);
      console.error('[useAudioPlayback] Audio error message:', audio.error?.message);
      setHasError(true);
      setIsPlaying(false);
      setIsLoading(false);
    };
    
    // Ensure we have a duration even if metadata doesn't load
    const handleCanPlay = () => {
      console.log(`[useAudioPlayback] Audio can play, duration: ${audio.duration}`);
      audioReadyRef.current = true;
      
      if (isNaN(audio.duration) || audio.duration <= 0) {
        console.log('[useAudioPlayback] Setting fallback duration');
        setAudioDuration(1);
        stableDurationRef.current = 1;
      } else {
        stableDurationRef.current = audio.duration;
        setAudioDuration(audio.duration);
      }
      
      setIsLoading(false);
    };
    
    // Attach event listeners
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    
    // Return cleanup function
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [onPlaybackEnd]);

  // Prepare audio for playback
  const prepareAudio = useCallback((forceReload = false) => {
    return new Promise<number>((resolve) => {
      if (forceReload) {
        reset();
      }
      
      if (!audioBlob) {
        console.log('[useAudioPlayback] No audio blob provided');
        setAudioDuration(1); // Use minimum default duration
        stableDurationRef.current = 1;
        resolve(1);
        return;
      }
      
      console.log(`[useAudioPlayback] Preparing audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
      
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      
      setIsLoading(true);
      setHasError(false);
      
      // Revoke any existing object URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      
      // For very small blobs, add padding to prevent playback issues
      let blobToUse = audioBlob;
      if (audioBlob.size < 1000) {
        console.log('[useAudioPlayback] Audio blob is very small, adding significant padding');
        const padding = new Uint8Array(65536).fill(0); // 64KB padding
        blobToUse = new Blob([audioBlob, padding], { 
          type: audioBlob.type || 'audio/wav' 
        });
      }
      
      // Create a new object URL
      const objectUrl = URL.createObjectURL(blobToUse);
      objectUrlRef.current = objectUrl;
      
      const audio = audioRef.current;
      
      // Clear out any previous track
      audio.src = '';
      audio.load();
      
      // Set preload attribute for better performance
      audio.preload = 'auto';
      
      // Set up event listeners for loading
      const loadHandler = () => {
        const duration = isNaN(audio.duration) || !isFinite(audio.duration) 
          ? 1 // Fallback duration for empty/invalid audio
          : audio.duration;
        
        console.log(`[useAudioPlayback] Audio loaded: duration=${duration}s, type=${blobToUse.type}`);
        setAudioDuration(duration);
        stableDurationRef.current = duration;
        audioReadyRef.current = true;
        setIsLoading(false);
        resolve(duration);
      };
      
      const errorHandler = (e: ErrorEvent | Event) => {
        console.error('[useAudioPlayback] Error loading audio:', e);
        console.error('[useAudioPlayback] Error code:', audio.error?.code);
        
        setHasError(true);
        setIsLoading(false);
        
        // Try using a different format as fallback
        if (blobToUse.type.includes('webm') && playAttemptCountRef.current < 2) {
          console.log('[useAudioPlayback] Trying fallback format (WAV)');
          const fallbackBlob = new Blob([blobToUse], { type: 'audio/wav' });
          URL.revokeObjectURL(objectUrl);
          const newUrl = URL.createObjectURL(fallbackBlob);
          objectUrlRef.current = newUrl;
          audio.src = newUrl;
          audio.load();
        } else {
          // Set minimum duration as fallback
          setAudioDuration(1);
          stableDurationRef.current = 1;
          resolve(1);
        }
      };
      
      // Add event listeners
      audio.addEventListener('loadedmetadata', loadHandler);
      audio.addEventListener('error', errorHandler as EventListener);
      
      // Set src after event listeners are added
      audio.src = objectUrl;
      
      // Safety timeout in case metadata never loads
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.warn('[useAudioPlayback] Audio metadata loading timed out, using fallback');
          setAudioDuration(1); // Set minimal duration
          stableDurationRef.current = 1;
          audioReadyRef.current = true;
          setIsLoading(false);
          resolve(1);
          
          // Remove event listeners that won't fire
          audio.removeEventListener('loadedmetadata', loadHandler);
          audio.removeEventListener('error', errorHandler as EventListener);
        }
      }, 2000);
      
      // Handle cleanup
      return () => {
        clearTimeout(timeout);
        audio.removeEventListener('loadedmetadata', loadHandler);
        audio.removeEventListener('error', errorHandler as EventListener);
      };
    });
  }, [audioBlob, reset, isLoading]);

  // Initialize or update audio source when blob changes
  useEffect(() => {
    if (audioBlob) {
      console.log(`[useAudioPlayback] New audio blob received: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
      prepareAudio();
      const cleanup = setupAudioListeners();
      return () => {
        if (cleanup) cleanup();
      };
    } else {
      reset();
    }
  }, [audioBlob, prepareAudio, reset, setupAudioListeners]);

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return {
    isPlaying,
    playbackProgress,
    audioDuration: stableDurationRef.current, // Use stable duration reference
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
