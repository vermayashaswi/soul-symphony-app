
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface UseAudioPlaybackProps {
  audioBlob: Blob | null;
}

interface UseAudioPlaybackReturn {
  isPlaying: boolean;
  playbackProgress: number;
  audioDuration: number;
  togglePlayback: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
}

export function useAudioPlayback({ audioBlob }: UseAudioPlaybackProps): UseAudioPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackTimerRef = useRef<number | null>(null);

  const togglePlayback = () => {
    if (!audioRef.current || !audioBlob) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    } else {
      // Create a new audio element each time to ensure fresh playback
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      
      // Setup audio duration and progress tracking
      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current) {
          setAudioDuration(audioRef.current.duration);
        }
      };
      
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          
          // Setup progress tracking timer
          playbackTimerRef.current = window.setInterval(() => {
            if (audioRef.current) {
              const currentTime = audioRef.current.currentTime;
              const duration = audioRef.current.duration;
              setPlaybackProgress(Math.floor((currentTime / duration) * 100));
            }
          }, 100); // Update progress more frequently (every 100ms)
        })
        .catch(err => {
          console.error('Error playing audio:', err);
          toast.error('Failed to play the recording.');
        });
    }
  };

  // Set up audio ended handler
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current);
          playbackTimerRef.current = null;
        }
      };
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
      }
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [audioBlob]);

  return {
    isPlaying,
    playbackProgress,
    audioDuration,
    togglePlayback,
    audioRef
  };
}
