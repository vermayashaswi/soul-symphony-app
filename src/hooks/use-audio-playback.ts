
import { useState, useEffect, useRef } from 'react';

interface UseAudioPlaybackProps {
  audioBlob: Blob | null;
}

export function useAudioPlayback({ audioBlob }: UseAudioPlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressUpdateInterval = useRef<number | null>(null);
  
  // Set up audio when blob changes
  useEffect(() => {
    if (audioBlob) {
      console.log("[AudioPlayback] Setting up with blob:", audioBlob.type, audioBlob.size);
      
      // Clean up any previous URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      // Create audio element if it doesn't exist
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      
      // Configure audio element
      audioRef.current.src = url;
      audioRef.current.load();
      
      // Get duration when metadata is loaded
      const handleLoadedMetadata = () => {
        if (audioRef.current) {
          const duration = audioRef.current.duration || 0;
          console.log("[AudioPlayback] Duration loaded:", duration);
          setAudioDuration(duration);
        }
      };
      
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      // If metadata is already loaded, update duration immediately
      if (audioRef.current.readyState >= 2) {
        const duration = audioRef.current.duration || 0;
        console.log("[AudioPlayback] Duration immediately available:", duration);
        setAudioDuration(duration);
      } else {
        console.log("[AudioPlayback] Waiting for metadata to load");
      }
      
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
      };
    } else {
      // Clean up if no audio blob
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioUrl(null);
      setAudioDuration(0);
      setPlaybackProgress(0);
      setIsPlaying(false);
    }
  }, [audioBlob]);
  
  // Set up event listeners for the audio element
  useEffect(() => {
    if (!audioRef.current || !audioUrl) return;
    
    console.log("[AudioPlayback] Setting up event listeners for audio element");
    
    // More accurate progress tracking with manual interval
    const updateProgress = () => {
      if (audioRef.current && !audioRef.current.paused) {
        const currentProgress = audioRef.current.currentTime / (audioRef.current.duration || 1);
        setPlaybackProgress(currentProgress);
      }
    };
    
    // Event listeners for audio playback
    const handlePlay = () => {
      console.log("[AudioPlayback] Play event");
      // Start progress tracking interval
      progressUpdateInterval.current = window.setInterval(updateProgress, 50);
      setIsPlaying(true);
    };
    
    const handlePause = () => {
      console.log("[AudioPlayback] Pause event");
      // Clear progress tracking interval
      if (progressUpdateInterval.current) {
        clearInterval(progressUpdateInterval.current);
        progressUpdateInterval.current = null;
      }
      setIsPlaying(false);
      
      // Update progress one last time for accuracy
      updateProgress();
    };
    
    const handleEnded = () => {
      console.log("[AudioPlayback] Ended event");
      setIsPlaying(false);
      setPlaybackProgress(1); // Set to end
      
      // Clear interval
      if (progressUpdateInterval.current) {
        clearInterval(progressUpdateInterval.current);
        progressUpdateInterval.current = null;
      }
      
      // Don't auto-reset to beginning
      if (audioRef.current) {
        audioRef.current.currentTime = audioRef.current.duration;
      }
    };
    
    const handleTimeUpdate = () => {
      // This is a backup for the interval-based tracking
      if (audioRef.current) {
        const progress = audioRef.current.currentTime / (audioRef.current.duration || 1);
        
        // Only update if significantly different to avoid conflicts with interval updates
        if (Math.abs(progress - playbackProgress) > 0.02) {
          setPlaybackProgress(progress);
        }
      }
    };
    
    // Attach all event listeners
    audioRef.current.addEventListener('play', handlePlay);
    audioRef.current.addEventListener('pause', handlePause);
    audioRef.current.addEventListener('ended', handleEnded);
    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('play', handlePlay);
        audioRef.current.removeEventListener('pause', handlePause);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      }
      
      // Clear any interval
      if (progressUpdateInterval.current) {
        clearInterval(progressUpdateInterval.current);
        progressUpdateInterval.current = null;
      }
    };
  }, [audioUrl, playbackProgress]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Pause and unload audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      
      // Clear any interval
      if (progressUpdateInterval.current) {
        clearInterval(progressUpdateInterval.current);
      }
      
      // Release object URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);
  
  const togglePlayback = () => {
    console.log("[AudioPlayback] Toggle playback called, isPlaying:", isPlaying);
    if (!audioRef.current || !audioUrl) {
      console.log("[AudioPlayback] No audio element or URL available");
      return;
    }
    
    if (isPlaying) {
      console.log("[AudioPlayback] Pausing audio");
      audioRef.current.pause();
      // setIsPlaying will be handled by the pause event
    } else {
      console.log("[AudioPlayback] Starting audio playback");
      // If at end, reset to beginning
      if (playbackProgress >= 0.99 && audioRef.current) {
        console.log("[AudioPlayback] Resetting to beginning");
        audioRef.current.currentTime = 0;
        setPlaybackProgress(0);
      }
      
      // Start playback with explicit error handling
      try {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('[AudioPlayback] Error playing audio:', error);
            setIsPlaying(false);
          });
        }
      } catch (error) {
        console.error('[AudioPlayback] Exception playing audio:', error);
        setIsPlaying(false);
      }
      // setIsPlaying will be handled by the play event
    }
  };
  
  const reset = () => {
    console.log("[AudioPlayback] Resetting playback");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setPlaybackProgress(0);
  };
  
  return {
    isPlaying,
    playbackProgress,
    audioDuration,
    togglePlayback,
    audioRef,
    reset
  };
}
