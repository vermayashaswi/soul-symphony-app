
import { useState, useRef, useEffect } from 'react';

interface UseAudioPlaybackProps {
  audioBlob: Blob | null;
}

export function useAudioPlayback({ audioBlob }: UseAudioPlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressTimerRef = useRef<number | null>(null);

  // Set up the audio when the blob changes
  useEffect(() => {
    if (audioRef.current && audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      audioRef.current.addEventListener('loadedmetadata', () => {
        if (audioRef.current) {
          setAudioDuration(audioRef.current.duration);
          console.log(`Audio duration: ${audioRef.current.duration}s`);
        }
      });

      return () => {
        URL.revokeObjectURL(audioUrl);
      };
    }
  }, [audioBlob]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  // Set up event listeners for the audio element
  useEffect(() => {
    if (!audioRef.current) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setPlaybackProgress(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    };

    audioRef.current.addEventListener('play', handlePlay);
    audioRef.current.addEventListener('pause', handlePause);
    audioRef.current.addEventListener('ended', handleEnded);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('play', handlePlay);
        audioRef.current.removeEventListener('pause', handlePause);
        audioRef.current.removeEventListener('ended', handleEnded);
      }
    };
  }, []);

  // Update progress during playback
  useEffect(() => {
    if (isPlaying) {
      progressTimerRef.current = window.setInterval(() => {
        if (audioRef.current) {
          const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
          setPlaybackProgress(progress);
        }
      }, 50);
    } else if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [isPlaying]);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
      });
    }
  };

  const reset = () => {
    setIsPlaying(false);
    setPlaybackProgress(0);
    setAudioDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
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
