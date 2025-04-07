
import { useState, useRef, useEffect } from 'react';

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

  const reset = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setPlaybackProgress(0);
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioBlob) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    } else {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          if (onPlaybackStart) onPlaybackStart();
          
          if (progressIntervalRef.current) {
            window.clearInterval(progressIntervalRef.current);
          }
          
          // Update progress more frequently for smoother slider movement
          progressIntervalRef.current = window.setInterval(() => {
            if (audioRef.current) {
              const progress = audioRef.current.currentTime / (audioRef.current.duration || 1);
              setPlaybackProgress(progress);
            }
          }, 50); // Update every 50ms for smoother progress
        })
        .catch(err => {
          console.error('Error playing audio:', err);
        });
    }
  };

  const seekTo = (position: number) => {
    if (!audioRef.current) return;
    
    const newTime = position * audioDuration;
    audioRef.current.currentTime = newTime;
    setPlaybackProgress(position);
  };

  const prepareAudio = async () => {
    return new Promise<number>((resolve) => {
      if (!audioBlob || !audioRef.current) {
        setAudioDuration(0);
        resolve(0);
        return;
      }
      
      // Create a new object URL when the blob changes
      const objectUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = objectUrl;
      
      // Wait for metadata to load to get duration
      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current) {
          const duration = audioRef.current.duration;
          setAudioDuration(duration);
          resolve(duration);
        } else {
          resolve(0);
        }
      };
      
      // Handle errors
      audioRef.current.onerror = () => {
        console.error('Error loading audio metadata');
        setAudioDuration(0);
        resolve(0);
      };
      
      // Clean up the object URL on unmount
      return () => {
        URL.revokeObjectURL(objectUrl);
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
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
    
    audioRef.current.addEventListener('ended', handleEnded);
    
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleEnded);
      }
      
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [onPlaybackEnd]);

  // Initialize or update audio source when blob changes
  useEffect(() => {
    if (audioBlob && audioRef.current) {
      reset();
      prepareAudio();
    }
    
    return () => {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [audioBlob]);

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
