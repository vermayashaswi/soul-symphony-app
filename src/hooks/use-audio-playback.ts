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
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUrl = useRef<string | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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
      // Clean up old URL
      if (audioUrl.current) {
        URL.revokeObjectURL(audioUrl.current);
      }
      
      // Create new URL
      audioUrl.current = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl.current;
      
      // Load audio to get duration
      audioRef.current.load();
      
      // When metadata is loaded, we can access the duration
      const handleLoadedMetadata = () => {
        if (audioRef.current) {
          setAudioDuration(audioRef.current.duration);
        }
      };
      
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
      };
    }
  }, [audioBlob]);
  
  // Set up audio playback event listeners
  useEffect(() => {
    const audioElement = audioRef.current;
    
    if (audioElement) {
      const handlePlay = () => {
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
        setIsPlaying(false);
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
          updateIntervalRef.current = null;
        }
      };
      
      const handleEnded = () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
        if (onPlaybackEnd) onPlaybackEnd();
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
          updateIntervalRef.current = null;
        }
      };
      
      audioElement.addEventListener('play', handlePlay);
      audioElement.addEventListener('pause', handlePause);
      audioElement.addEventListener('ended', handleEnded);
      
      return () => {
        audioElement.removeEventListener('play', handlePlay);
        audioElement.removeEventListener('pause', handlePause);
        audioElement.removeEventListener('ended', handleEnded);
        
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
    
    if (isPlaying) {
      audio.pause();
    } else {
      // Reset to beginning if at the end
      if (audio.currentTime >= audio.duration) {
        audio.currentTime = 0;
      }
      audio.play().catch((error) => {
        console.error('Error playing audio:', error);
      });
    }
  };
  
  const seekTo = (position: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    
    const seekTime = position * audio.duration;
    audio.currentTime = seekTime;
    setPlaybackProgress(position);
  };
  
  const reset = () => {
    setIsPlaying(false);
    setPlaybackProgress(0);
    setAudioDuration(0);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  };
  
  // Function to prepare audio to ensure duration is loaded - similar to what happens on play
  const prepareAudio = (): Promise<number> => {
    return new Promise((resolve) => {
      const audio = audioRef.current;
      if (!audio || !audioBlob) {
        resolve(0);
        return;
      }
      
      // If we already have duration loaded, return it immediately
      if (audioDuration > 0) {
        resolve(audioDuration);
        return;
      }
      
      // Otherwise, load the audio and wait for metadata
      const handleMetadata = () => {
        const duration = audio.duration;
        setAudioDuration(duration);
        audio.removeEventListener('loadedmetadata', handleMetadata);
        resolve(duration);
      };
      
      // If metadata is already loaded
      if (audio.readyState >= 2 && audio.duration) {
        setAudioDuration(audio.duration);
        resolve(audio.duration);
        return;
      }
      
      // Otherwise wait for it to load
      audio.addEventListener('loadedmetadata', handleMetadata);
      
      // In case we never get the event, resolve after a timeout
      setTimeout(() => {
        if (audio.duration) {
          setAudioDuration(audio.duration);
          resolve(audio.duration);
        } else {
          // If we can't get the duration, estimate it from the blob size
          // Rough estimate: ~128kbps audio = 16KB per second
          const estimatedDuration = audioBlob.size / (16 * 1024);
          setAudioDuration(estimatedDuration);
          resolve(estimatedDuration);
        }
        audio.removeEventListener('loadedmetadata', handleMetadata);
      }, 1000);
      
      // Trigger the load if needed
      if (audio.readyState === 0) {
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
  };
}
