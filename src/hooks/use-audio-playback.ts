
import { useState, useRef, useEffect } from 'react';

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
  const [isAudioPrepared, setIsAudioPrepared] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrl = useRef<string | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const metadataListenerAddedRef = useRef(false);
  const prepareAttemptCountRef = useRef(0);
  
  // Clean up previous URL when audioBlob changes
  useEffect(() => {
    return () => {
      if (audioUrl.current) {
        URL.revokeObjectURL(audioUrl.current);
        audioUrl.current = null;
      }
    };
  }, [audioBlob]);
  
  // Create new audio URL when blob changes
  useEffect(() => {
    if (audioBlob && audioRef.current) {
      console.log('[useAudioPlayback] New audio blob detected:', audioBlob.size, 'bytes');
      
      // Reset prep state
      setIsAudioPrepared(false);
      prepareAttemptCountRef.current = 0;
      
      // Clean up old URL
      if (audioUrl.current) {
        URL.revokeObjectURL(audioUrl.current);
      }
      
      // Create new URL
      audioUrl.current = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl.current;
      
      // Reset metadata listener flag
      metadataListenerAddedRef.current = false;
      
      // Load audio to get duration
      audioRef.current.load();
      
      // Prepare the audio immediately if it's a new blob
      prepareAudio().then(duration => {
        console.log('[useAudioPlayback] Audio prepared with duration:', duration);
      });
    }
  }, [audioBlob]);
  
  // Set up audio playback event listeners
  useEffect(() => {
    const audioElement = audioRef.current;
    
    if (audioElement) {
      const handlePlay = () => {
        console.log('[useAudioPlayback] Audio playback started');
        setIsPlaying(true);
        if (onPlaybackStart) onPlaybackStart();
        
        // Update progress at regular intervals
        updateIntervalRef.current = setInterval(() => {
          if (audioElement.duration) {
            setPlaybackProgress(audioElement.currentTime / audioElement.duration);
          }
        }, 50);
      };
      
      const handlePause = () => {
        console.log('[useAudioPlayback] Audio playback paused');
        setIsPlaying(false);
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
          updateIntervalRef.current = null;
        }
      };
      
      const handleEnded = () => {
        console.log('[useAudioPlayback] Audio playback ended');
        setIsPlaying(false);
        setPlaybackProgress(0);
        if (onPlaybackEnd) onPlaybackEnd();
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
          updateIntervalRef.current = null;
        }
      };
      
      // Add error handling
      const handleError = (e: any) => {
        console.error('[useAudioPlayback] Audio error:', e);
        setIsPlaying(false);
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
          updateIntervalRef.current = null;
        }
      };
      
      audioElement.addEventListener('play', handlePlay);
      audioElement.addEventListener('pause', handlePause);
      audioElement.addEventListener('ended', handleEnded);
      audioElement.addEventListener('error', handleError);
      
      return () => {
        audioElement.removeEventListener('play', handlePlay);
        audioElement.removeEventListener('pause', handlePause);
        audioElement.removeEventListener('ended', handleEnded);
        audioElement.removeEventListener('error', handleError);
        
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
          updateIntervalRef.current = null;
        }
      };
    }
  }, [onPlaybackStart, onPlaybackEnd]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl.current) {
        URL.revokeObjectURL(audioUrl.current);
      }
      
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);
  
  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    console.log('[useAudioPlayback] Toggle playback called, current state:', isPlaying);
    
    if (isPlaying) {
      audio.pause();
    } else {
      // Reset to beginning if at the end
      if (audio.currentTime >= audio.duration) {
        audio.currentTime = 0;
      }
      
      // Ensure audio is prepared before playing
      prepareAudio().then(() => {
        audio.play().catch((error) => {
          console.error('[useAudioPlayback] Error playing audio:', error);
        });
      });
    }
  };
  
  const seekTo = (position: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    
    const seekTime = position * audio.duration;
    audio.currentTime = seekTime;
    setPlaybackProgress(position);
    
    console.log('[useAudioPlayback] Seeking to:', seekTime, 'seconds');
  };
  
  const reset = () => {
    console.log('[useAudioPlayback] Resetting audio player');
    setIsPlaying(false);
    setPlaybackProgress(0);
    setAudioDuration(0);
    setIsAudioPrepared(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  };
  
  // Function to forcefully prepare audio with exponential backoff retry
  const prepareAudio = async (): Promise<number> => {
    if (isAudioPrepared && audioDuration > 0) {
      console.log('[useAudioPlayback] Audio already prepared, duration:', audioDuration);
      return audioDuration;
    }
    
    return new Promise((resolve) => {
      const audio = audioRef.current;
      if (!audio || !audioBlob) {
        setIsAudioPrepared(false);
        resolve(0);
        return;
      }
      
      prepareAttemptCountRef.current++;
      const attempt = prepareAttemptCountRef.current;
      console.log(`[useAudioPlayback] Preparing audio... (attempt ${attempt})`);
      
      // If we already have duration loaded, return it immediately
      if (audioDuration > 0) {
        console.log('[useAudioPlayback] Already have duration:', audioDuration);
        setIsAudioPrepared(true);
        resolve(audioDuration);
        return;
      }
      
      // Force reload the audio to ensure metadata is loaded
      try {
        if (audioUrl.current) {
          audio.src = audioUrl.current;
          audio.load();
        }
      } catch (e) {
        console.error('[useAudioPlayback] Error reloading audio:', e);
      }
      
      // Only add the listener once
      if (!metadataListenerAddedRef.current) {
        // Add a metadata listener
        const handleMetadata = () => {
          const duration = audio.duration;
          console.log('[useAudioPlayback] Metadata loaded, duration:', duration);
          setAudioDuration(duration);
          setIsAudioPrepared(true);
          audio.removeEventListener('loadedmetadata', handleMetadata);
          metadataListenerAddedRef.current = false;
          resolve(duration);
        };
        
        audio.addEventListener('loadedmetadata', handleMetadata);
        metadataListenerAddedRef.current = true;
      }
      
      // If metadata is already loaded
      if (audio.readyState >= 2 && audio.duration) {
        console.log('[useAudioPlayback] Metadata already loaded, duration:', audio.duration);
        setAudioDuration(audio.duration);
        setIsAudioPrepared(true);
        resolve(audio.duration);
        return;
      }
      
      // In case we never get the event, resolve after a timeout with exponential backoff
      const timeoutDuration = Math.min(1000 * Math.pow(1.5, attempt - 1), 5000);
      
      setTimeout(() => {
        if (audio.duration) {
          console.log(`[useAudioPlayback] Got duration after timeout (${timeoutDuration}ms):`, audio.duration);
          setAudioDuration(audio.duration);
          setIsAudioPrepared(true);
          resolve(audio.duration);
        } else {
          // If we can't get the duration, estimate it from the blob size
          // Rough estimate: ~128kbps audio = 16KB per second
          const estimatedDuration = audioBlob.size / (16 * 1024);
          console.log(`[useAudioPlayback] Estimating duration from size (attempt ${attempt}):`, estimatedDuration);
          setAudioDuration(estimatedDuration);
          setIsAudioPrepared(true);
          resolve(estimatedDuration);
        }
        
        if (metadataListenerAddedRef.current) {
          audio.removeEventListener('loadedmetadata', () => {});
          metadataListenerAddedRef.current = false;
        }
        
        // If we're still not successful and have attempts left, retry
        if (audio.duration === 0 && attempt < 3) {
          console.log(`[useAudioPlayback] Retrying prepare audio (attempt ${attempt + 1})`);
          prepareAudio().then(resolve);
        }
      }, timeoutDuration);
      
      // Trigger the load if needed
      if (audio.readyState === 0) {
        console.log('[useAudioPlayback] Triggering audio load');
        audio.load();
      }
    });
  };
  
  return {
    isPlaying,
    playbackProgress,
    audioDuration,
    togglePlayback,
    seekTo,
    reset,
    audioRef,
    prepareAudio,
    isAudioPrepared
  };
}
