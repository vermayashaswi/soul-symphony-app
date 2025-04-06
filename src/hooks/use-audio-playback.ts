
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
  const intervalRef = useRef<number | null>(null);
  
  // Set up audio when blob changes
  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      // Create temporary audio element to get duration
      const tempAudio = new Audio(url);
      tempAudio.addEventListener('loadedmetadata', () => {
        setAudioDuration(tempAudio.duration);
      });
      
      // Clean up temporary audio
      return () => {
        tempAudio.pause();
        tempAudio.src = '';
      };
    } else {
      setAudioUrl(null);
      setAudioDuration(0);
      setPlaybackProgress(0);
    }
  }, [audioBlob]);
  
  // Set up audio element when URL changes
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
      
      // Listen for audio timeupdate event
      const handleTimeUpdate = () => {
        if (audioRef.current) {
          const progress = audioRef.current.currentTime / audioRef.current.duration;
          setPlaybackProgress(progress || 0);
        }
      };
      
      // Listen for the end of audio
      const handleEnded = () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
        }
      };
      
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('ended', handleEnded);
      
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
          audioRef.current.removeEventListener('ended', handleEnded);
        }
      };
    }
  }, [audioUrl]);
  
  // Clean up audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [audioUrl]);
  
  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // When restarting playback after reaching the end, reset to beginning
      if (playbackProgress >= 0.99) {
        audioRef.current.currentTime = 0;
        setPlaybackProgress(0);
      }
      
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
      });
      setIsPlaying(true);
    }
  };
  
  const reset = () => {
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
