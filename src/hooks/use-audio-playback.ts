
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface UseAudioPlaybackProps {
  audioBlob: Blob | null;
}

export function useAudioPlayback({ audioBlob }: UseAudioPlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressUpdateInterval = useRef<number | null>(null);
  const audioElementCreated = useRef(false);
  
  // Set up audio when blob changes
  useEffect(() => {
    if (audioBlob) {
      console.log("[AudioPlayback] Setting up with blob:", audioBlob.type, audioBlob.size);
      
      // Reset states
      setIsPlaying(false);
      setPlaybackProgress(0);
      setAudioLoaded(false);
      setLastError(null);
      
      // Clean up any previous URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      try {
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Create audio element if it doesn't exist
        if (!audioRef.current) {
          console.log("[AudioPlayback] Creating new audio element");
          audioRef.current = new Audio();
          audioElementCreated.current = true;
        }
        
        // Configure audio element
        audioRef.current.src = url;
        audioRef.current.preload = "auto"; // Force preloading
        audioRef.current.load();
        
        console.log("[AudioPlayback] Audio element created and loaded");
      } catch (err) {
        console.error("[AudioPlayback] Error creating audio element:", err);
        setLastError(`Error loading audio: ${err instanceof Error ? err.message : String(err)}`);
        toast.error("Failed to load audio for playback", { duration: 3000 });
      }
    } else {
      // Clean up if no audio blob
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioUrl(null);
      setAudioDuration(0);
      setPlaybackProgress(0);
      setIsPlaying(false);
      setAudioLoaded(false);
    }
    
    // Cleanup function
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioBlob]);
  
  // Set up metadata loaded listener to get duration
  useEffect(() => {
    if (!audioRef.current || !audioUrl) return;
    
    console.log("[AudioPlayback] Setting up loadedmetadata listener");
    
    const handleLoadedMetadata = () => {
      if (audioRef.current) {
        const duration = audioRef.current.duration || 0;
        console.log("[AudioPlayback] Duration loaded:", duration);
        setAudioDuration(duration);
        setAudioLoaded(true);
        
        // Ensure we have at least some duration
        if (duration <= 0) {
          console.warn("[AudioPlayback] Zero or invalid duration detected");
          // Try to estimate duration from blob size (very rough)
          if (audioBlob) {
            const estimatedDuration = Math.max(1, audioBlob.size / 16000);
            console.log("[AudioPlayback] Estimated duration from size:", estimatedDuration);
            setAudioDuration(estimatedDuration);
          }
        }
      }
    };
    
    audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    // If metadata is already loaded, update duration immediately
    if (audioRef.current.readyState >= 2) {
      handleLoadedMetadata();
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
    };
  }, [audioUrl, audioBlob]);
  
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
      console.log("[AudioPlayback] Play event triggered");
      // Start progress tracking interval
      progressUpdateInterval.current = window.setInterval(updateProgress, 50);
      setIsPlaying(true);
    };
    
    const handlePause = () => {
      console.log("[AudioPlayback] Pause event triggered");
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
      console.log("[AudioPlayback] Ended event triggered");
      setIsPlaying(false);
      setPlaybackProgress(1); // Set to end
      
      // Clear interval
      if (progressUpdateInterval.current) {
        clearInterval(progressUpdateInterval.current);
        progressUpdateInterval.current = null;
      }
    };
    
    const handleError = (e: Event) => {
      const error = (e.target as HTMLAudioElement).error;
      const errorMsg = error ? `Audio error: ${error.code} - ${error.message}` : "Unknown audio error";
      console.error("[AudioPlayback] Audio element error:", errorMsg);
      setLastError(errorMsg);
      setIsPlaying(false);
      
      // Clear interval
      if (progressUpdateInterval.current) {
        clearInterval(progressUpdateInterval.current);
        progressUpdateInterval.current = null;
      }
      
      toast.error("Error playing audio", { duration: 3000 });
    };
    
    // Attach all event listeners
    audioRef.current.addEventListener('play', handlePlay);
    audioRef.current.addEventListener('pause', handlePause);
    audioRef.current.addEventListener('ended', handleEnded);
    audioRef.current.addEventListener('error', handleError);
    
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('play', handlePlay);
        audioRef.current.removeEventListener('pause', handlePause);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('error', handleError);
      }
      
      // Clear any interval
      if (progressUpdateInterval.current) {
        clearInterval(progressUpdateInterval.current);
        progressUpdateInterval.current = null;
      }
    };
  }, [audioUrl]);
  
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
    console.log("[AudioPlayback] Toggle playback called, isPlaying:", isPlaying, "audioLoaded:", audioLoaded);
    if (!audioRef.current || !audioUrl) {
      console.log("[AudioPlayback] No audio element or URL available");
      toast.error("Audio not available", { duration: 3000 });
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
            setLastError(`Play error: ${error instanceof Error ? error.message : String(error)}`);
            setIsPlaying(false);
            toast.error("Error playing audio", { duration: 3000 });
          });
        }
      } catch (error) {
        console.error('[AudioPlayback] Exception playing audio:', error);
        setLastError(`Play exception: ${error instanceof Error ? error.message : String(error)}`);
        setIsPlaying(false);
        toast.error("Error playing audio", { duration: 3000 });
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
    setLastError(null);
  };
  
  return {
    isPlaying,
    playbackProgress,
    audioDuration,
    togglePlayback,
    audioRef,
    audioLoaded,
    lastError,
    reset
  };
}
