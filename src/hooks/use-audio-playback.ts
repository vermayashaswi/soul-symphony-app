import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioPlaybackOptions {
  audioBlob: Blob | null;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
}

export function useAudioPlayback({ 
  audioBlob, 
  onPlaybackStart, 
  onPlaybackEnd 
}: UseAudioPlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const componentMountedRef = useRef(true);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const blobUrlRef = useRef<string | null>(null);
  
  // Helper function to safely set state only if component is mounted
  const safeSetState = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    if (componentMountedRef.current) {
      setter(value);
    }
  };
  
  // Clean up function for resources
  const cleanupResources = useCallback(() => {
    // Cancel animation frame if active
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Clear all timeouts
    timeoutsRef.current.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    timeoutsRef.current = [];
    
    // Revoke any object URLs
    if (blobUrlRef.current) {
      try {
        URL.revokeObjectURL(blobUrlRef.current);
      } catch (e) {
        console.warn('[useAudioPlayback] Error revoking URL:', e);
      }
      blobUrlRef.current = null;
    }
  }, []);
  
  // Set up mount/unmount tracking
  useEffect(() => {
    componentMountedRef.current = true;
    
    return () => {
      componentMountedRef.current = false;
      cleanupResources();
      
      // Additional cleanup for audio element
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = '';
          audioRef.current.load();
        } catch (e) {
          console.warn('[useAudioPlayback] Error cleaning up audio:', e);
        }
      }
    };
  }, [cleanupResources]);

  // Create and load audio when blob changes
  useEffect(() => {
    // Reset state for new blob
    safeSetState(setIsPlaying, false);
    safeSetState(setPlaybackProgress, 0);
    safeSetState(setAudioDuration, 0);
    safeSetState(setAudioUrl, null);
    safeSetState(setAudioLoaded, false);
    
    // Clean up previous resources
    cleanupResources();
    
    // Only proceed if we have a blob
    if (!audioBlob) return;
    
    // Create a new URL for the blob
    try {
      const url = URL.createObjectURL(audioBlob);
      blobUrlRef.current = url;
      safeSetState(setAudioUrl, url);
      
      // Wait for next tick to create audio element
      const timeoutId = setTimeout(() => {
        if (!componentMountedRef.current) return;
        
        // Create audio element if needed
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        
        // Set up event listeners
        const audio = audioRef.current;
        
        const handleCanPlay = () => {
          if (!componentMountedRef.current) return;
          
          try {
            safeSetState(setAudioLoaded, true);
            safeSetState(setAudioDuration, audio.duration || 0);
            console.log('[useAudioPlayback] Audio loaded, duration:', audio.duration);
          } catch (e) {
            console.warn('[useAudioPlayback] Error in canplay handler:', e);
          }
        };
        
        const handlePlay = () => {
          if (!componentMountedRef.current) return;
          try {
            safeSetState(setIsPlaying, true);
            if (onPlaybackStart) onPlaybackStart();
            console.log('[useAudioPlayback] Audio playing');
            
            // Start updating progress
            const updateProgress = () => {
              if (!componentMountedRef.current) return;
              if (!audio) return;
              
              try {
                if (!audio.paused) {
                  const progress = audio.currentTime / (audio.duration || 1);
                  safeSetState(setPlaybackProgress, progress);
                  animationFrameRef.current = requestAnimationFrame(updateProgress);
                }
              } catch (e) {
                console.warn('[useAudioPlayback] Error updating progress:', e);
              }
            };
            
            // Start progress updates
            if (animationFrameRef.current !== null) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            animationFrameRef.current = requestAnimationFrame(updateProgress);
          } catch (e) {
            console.warn('[useAudioPlayback] Error in play handler:', e);
          }
        };
        
        const handlePause = () => {
          if (!componentMountedRef.current) return;
          try {
            safeSetState(setIsPlaying, false);
            
            // Stop progress updates
            if (animationFrameRef.current !== null) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = null;
            }
          } catch (e) {
            console.warn('[useAudioPlayback] Error in pause handler:', e);
          }
        };
        
        const handleEnded = () => {
          if (!componentMountedRef.current) return;
          try {
            safeSetState(setIsPlaying, false);
            safeSetState(setPlaybackProgress, 0);
            
            if (audio) {
              audio.currentTime = 0;
            }
            
            if (onPlaybackEnd) onPlaybackEnd();
            
            // Stop progress updates
            if (animationFrameRef.current !== null) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = null;
            }
          } catch (e) {
            console.warn('[useAudioPlayback] Error in ended handler:', e);
          }
        };
        
        const handleError = (e: ErrorEvent) => {
          if (!componentMountedRef.current) return;
          console.error('[useAudioPlayback] Audio error:', e);
          safeSetState(setIsPlaying, false);
          safeSetState(setAudioLoaded, false);
        };
        
        // Set up event listeners
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError as EventListener);
        
        // Load audio
        audio.src = url;
        audio.preload = 'metadata';
        audio.load();
        
        // Clean up on unmount or when audio blob changes
        return () => {
          try {
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError as EventListener);
            
            audio.pause();
            audio.src = '';
          } catch (e) {
            console.warn('[useAudioPlayback] Error removing event listeners:', e);
          }
        };
      }, 10);
      
      timeoutsRef.current.push(timeoutId);
    } catch (e) {
      console.error('[useAudioPlayback] Error creating audio URL:', e);
    }
  }, [audioBlob, onPlaybackStart, onPlaybackEnd, cleanupResources]);

  // Toggle playback
  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioLoaded) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => {
          console.error('[useAudioPlayback] Error playing audio:', e);
        });
      }
    } catch (e) {
      console.error('[useAudioPlayback] Error toggling playback:', e);
    }
  }, [isPlaying, audioLoaded]);

  // Seek to position
  const seekTo = useCallback((position: number) => {
    if (!audioRef.current || !audioLoaded) return;
    
    try {
      const targetTime = position * audioRef.current.duration;
      audioRef.current.currentTime = targetTime;
      safeSetState(setPlaybackProgress, position);
    } catch (e) {
      console.error('[useAudioPlayback] Error seeking:', e);
    }
  }, [audioLoaded]);

  // Reset playback
  const reset = useCallback(() => {
    // Clean up resources
    cleanupResources();
    
    // Reset state
    safeSetState(setIsPlaying, false);
    safeSetState(setPlaybackProgress, 0);
    safeSetState(setAudioDuration, 0);
    safeSetState(setAudioUrl, null);
    safeSetState(setAudioLoaded, false);
    
    // Reset audio element
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      } catch (e) {
        console.warn('[useAudioPlayback] Error resetting audio:', e);
      }
    }
  }, [cleanupResources]);

  // Prepare audio (ensure it's loaded) and return duration
  const prepareAudio = useCallback(async (): Promise<number> => {
    if (!audioBlob) return 0;
    
    // If audio is already loaded, return duration
    if (audioLoaded && audioRef.current) {
      return audioRef.current.duration;
    }
    
    // Otherwise, prepare it
    return new Promise((resolve, reject) => {
      try {
        // Clean up previous URL
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        
        // Create new URL
        const url = URL.createObjectURL(audioBlob);
        blobUrlRef.current = url;
        safeSetState(setAudioUrl, url);
        
        // Create audio element if needed
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        
        const audio = audioRef.current;
        
        // Set up handlers
        const handleCanPlay = () => {
          try {
            safeSetState(setAudioLoaded, true);
            safeSetState(setAudioDuration, audio.duration || 0);
            
            console.log('[useAudioPlayback] Audio prepared, duration:', audio.duration);
            resolve(audio.duration || 0);
          } catch (e) {
            console.warn('[useAudioPlayback] Error in canplay handler:', e);
            reject(e);
          }
        };
        
        const handleError = (e: ErrorEvent) => {
          console.error('[useAudioPlayback] Audio preparation error:', e);
          safeSetState(setAudioLoaded, false);
          reject(new Error('Failed to load audio'));
        };
        
        // Set up event listeners
        audio.addEventListener('canplay', handleCanPlay, { once: true });
        audio.addEventListener('error', handleError as EventListener, { once: true });
        
        // Set timeout for loading
        const timeoutId = setTimeout(() => {
          try {
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError as EventListener);
            
            // Try to get duration anyway, or use the blob duration property
            const estimatedDuration = 
              audio.duration || 
              ('duration' in audioBlob ? (audioBlob as any).duration : 0) || 
              0;
            
            console.warn('[useAudioPlayback] Audio load timed out, using estimated duration:', estimatedDuration);
            safeSetState(setAudioDuration, estimatedDuration);
            safeSetState(setAudioLoaded, true);
            
            resolve(estimatedDuration);
          } catch (e) {
            console.error('[useAudioPlayback] Error in timeout handler:', e);
            reject(e);
          }
        }, 3000);
        
        timeoutsRef.current.push(timeoutId);
        
        // Load audio
        audio.src = url;
        audio.preload = 'metadata';
        audio.load();
      } catch (e) {
        console.error('[useAudioPlayback] Error preparing audio:', e);
        reject(e);
      }
    });
  }, [audioBlob, audioLoaded]);

  return {
    isPlaying,
    playbackProgress,
    audioDuration,
    audioUrl,
    audioRef,
    audioLoaded,
    togglePlayback,
    seekTo,
    reset,
    prepareAudio
  };
}
