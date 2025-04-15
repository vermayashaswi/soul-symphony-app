
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
      if (!audioRef.current || audioRef.current.readyState < 2) {
        console.log('[useAudioPlayback] Audio not ready for playback, loading...');
        setIsLoading(true);
        
        // Force reload the audio source
        prepareAudio().then(() => {
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
          
          // Retry with user interaction for mobile browsers
          if (playAttemptCountRef.current < 3) {
            console.log('[useAudioPlayback] Retrying with user interaction helper');
            
            const handleUserInteraction = () => {
              if (!audioRef.current) return;
              
              console.log('[useAudioPlayback] User interaction detected, retrying playback');
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
                    console.error('[useAudioPlayback] Retry failed:', e);
                    // Last resort - regenerate audio element completely
                    if (playAttemptCountRef.current === 2) {
                      console.log('[useAudioPlayback] Final attempt - recreating audio element');
                      recreateAudioElement();
                    }
                  });
              }
              
              // Clean up listeners 
              document.removeEventListener('touchend', handleUserInteraction);
              document.removeEventListener('click', handleUserInteraction);
            };
            
            document.addEventListener('touchend', handleUserInteraction, { once: true });
            document.addEventListener('click', handleUserInteraction, { once: true });
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
    prepareAudio().then(() => {
      console.log('[useAudioPlayback] Audio element recreated and prepared');
    });
  }, []);

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
        const progress = audio.currentTime / audio.duration;
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
    
    // Attach event listeners
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleError);
    
    // Return cleanup function
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleError);
    };
  }, [onPlaybackEnd]);

  // Prepare audio for playback
  const prepareAudio = useCallback(() => {
    return new Promise<number>((resolve) => {
      reset();
      
      if (!audioBlob) {
        console.log('[useAudioPlayback] No audio blob provided');
        setAudioDuration(0);
        resolve(0);
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
      if (audioBlob.size < 200) {
        console.log('[useAudioPlayback] Audio blob is very small, adding padding');
        const padding = new Uint8Array(8192).fill(0);
        blobToUse = new Blob([audioBlob, padding], { 
          type: audioBlob.type || 'audio/webm;codecs=opus' 
        });
      }
      
      // Create a new object URL
      const objectUrl = URL.createObjectURL(blobToUse);
      objectUrlRef.current = objectUrl;
      
      const audio = audioRef.current;
      
      // Clear out any previous track
      audio.src = '';
      audio.load();
      
      // Set up event listeners
      const loadHandler = () => {
        const duration = isNaN(audio.duration) || !isFinite(audio.duration) 
          ? 0.1 // Fallback duration for empty/invalid audio
          : audio.duration;
        
        console.log(`[useAudioPlayback] Audio loaded: duration=${duration}s, type=${blobToUse.type}`);
        setAudioDuration(duration);
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
          setAudioDuration(0.1); // Set minimal fallback duration
          resolve(0.1);
        }
      };
      
      // Add event listeners
      audio.addEventListener('loadedmetadata', loadHandler);
      audio.addEventListener('error', errorHandler as EventListener);
      
      // Set preload attribute for better performance
      audio.preload = 'auto';
      audio.src = objectUrl;
      
      // Safety timeout in case metadata never loads
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.warn('[useAudioPlayback] Audio metadata loading timed out, using fallback');
          setAudioDuration(0.1); // Set minimal duration
          setIsLoading(false);
          resolve(0.1);
          
          // Remove event listeners that won't fire
          audio.removeEventListener('loadedmetadata', loadHandler);
          audio.removeEventListener('error', errorHandler as EventListener);
        }
      }, 3000);
      
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
