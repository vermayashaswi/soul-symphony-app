
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const reset = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setPlaybackProgress(0);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const updateProgress = useCallback(() => {
    if (audioRef.current && audioDuration) {
      const currentTime = audioRef.current.currentTime;
      const progress = currentTime / audioDuration;
      
      // Ensure progress is within valid range
      const clampedProgress = Math.max(0, Math.min(1, progress));
      setPlaybackProgress(clampedProgress);
      
      // Continue updating progress
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [audioDuration]);

  const togglePlayback = () => {
    if (!audioRef.current || !audioBlob) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    } else {
      // Create a promise that resolves when the audio can play through
      const canPlayPromise = new Promise<void>((resolve) => {
        if (audioRef.current) {
          // Listen for canplaythrough event
          const handleCanPlayThrough = () => {
            resolve();
            audioRef.current?.removeEventListener('canplaythrough', handleCanPlayThrough);
          };
          
          // If we already have enough data, resolve immediately
          if (audioRef.current.readyState >= 3) {
            resolve();
          } else {
            audioRef.current.addEventListener('canplaythrough', handleCanPlayThrough, { once: true });
          }
        } else {
          resolve(); // Resolve anyway if no audio ref
        }
      });
      
      // Wait for audio to be ready, then play
      canPlayPromise.then(() => {
        if (!audioRef.current) return;
        
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            if (onPlaybackStart) onPlaybackStart();
            
            // Start updating progress with requestAnimationFrame for smoother updates
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            animationFrameRef.current = requestAnimationFrame(updateProgress);
          })
          .catch(err => {
            console.error('Error playing audio:', err);
            // Try again with user interaction for iOS
            const resumeAudio = () => {
              if (!audioRef.current) return;
              audioRef.current.play()
                .then(() => {
                  setIsPlaying(true);
                  if (onPlaybackStart) onPlaybackStart();
                  animationFrameRef.current = requestAnimationFrame(updateProgress);
                  document.removeEventListener('touchend', resumeAudio);
                })
                .catch(innerErr => {
                  console.error('Failed to play audio after user interaction:', innerErr);
                });
            };
            
            // Add event listener for user interaction (needed for iOS)
            document.addEventListener('touchend', resumeAudio, { once: true });
          });
      });
    }
  };

  const seekTo = (position: number) => {
    if (!audioRef.current) return;
    
    const newTime = position * audioDuration;
    audioRef.current.currentTime = newTime;
    setPlaybackProgress(position);
    
    // Force update the playback progress display immediately
    const currentProgress = newTime / audioDuration;
    setPlaybackProgress(currentProgress);
    
    // Fix for iOS where seeking doesn't update time immediately
    if (isPlaying && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      const currentTime = audioRef.current.currentTime;
      setTimeout(() => {
        if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) < 0.1) {
          // If time hasn't changed after 50ms, we need to force it
          audioRef.current.currentTime = newTime;
        }
      }, 50);
    }
  };

  const prepareAudio = async () => {
    return new Promise<number>((resolve) => {
      if (!audioBlob || !audioRef.current) {
        setAudioDuration(0);
        resolve(0);
        return;
      }
      
      // Revoke any existing object URL
      if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      
      // Create a new object URL when the blob changes
      const objectUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = objectUrl;
      
      // Wait for metadata to load to get duration
      const onMetadataLoaded = () => {
        if (audioRef.current) {
          const duration = audioRef.current.duration;
          setAudioDuration(duration);
          audioRef.current.removeEventListener('loadedmetadata', onMetadataLoaded);
          resolve(duration);
        } else {
          resolve(0);
        }
      };
      
      // Handle errors
      const onError = () => {
        console.error('Error loading audio metadata');
        audioRef.current?.removeEventListener('error', onError);
        setAudioDuration(0);
        resolve(0);
      };
      
      audioRef.current.addEventListener('loadedmetadata', onMetadataLoaded);
      audioRef.current.addEventListener('error', onError);
      
      // iOS Safari sometimes needs preload
      audioRef.current.preload = 'metadata';
      
      // If duration is already available (cached audio)
      if (audioRef.current.duration && audioRef.current.duration !== Infinity) {
        setAudioDuration(audioRef.current.duration);
        resolve(audioRef.current.duration);
      }
      
      // Return cleanup function
      return () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      };
    });
  };

  // Handle audio ended event
  useEffect(() => {
    if (!audioRef.current) return;
    
    const handleEnded = () => {
      setIsPlaying(false);
      setPlaybackProgress(0);
      if (onPlaybackEnd) onPlaybackEnd();
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      // Reset the playback position to the beginning
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    };
    
    // Also listen for timeupdate events to ensure progress stays in sync
    const handleTimeUpdate = () => {
      if (audioRef.current && !isNaN(audioRef.current.duration)) {
        const progress = audioRef.current.currentTime / audioRef.current.duration;
        setPlaybackProgress(progress);
      }
    };
    
    audioRef.current.addEventListener('ended', handleEnded);
    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [onPlaybackEnd, isPlaying]);

  // Initialize or update audio source when blob changes
  useEffect(() => {
    if (audioBlob && audioRef.current) {
      reset();
      prepareAudio();
    }
    
    return () => {
      reset();
    };
  }, [audioBlob]);

  // Fix for iOS Safari - ensure audio element is created properly
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'metadata';
    }
  }, []);

  return {
    isPlaying,
    playbackProgress,
    audioDuration,
    togglePlayback,
    audioRef,
    reset,
    seekTo,
    prepareAudio
  };
}

export default useAudioPlayback;
