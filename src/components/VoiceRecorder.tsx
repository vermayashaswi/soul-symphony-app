
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  onRecordingComplete?: (blob: Blob) => void;
  className?: string;
}

export function VoiceRecorder({ onRecordingComplete, className }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [ripples, setRipples] = useState<number[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        if (onRecordingComplete) {
          onRecordingComplete(blob);
        }
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      setIsRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);
      mediaRecorder.start();
      
      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
        
        // Add a new ripple every 2 seconds
        if ((recordingTime % 2) === 0) {
          setRipples(prev => [...prev, Date.now()]);
        }
      }, 1000);
      
      // Initial ripple
      setRipples([Date.now()]);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Clear ripples
      setRipples([]);
      
      toast.success('Recording saved!');
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioBlob) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  // Clean up old ripples
  useEffect(() => {
    if (ripples.length > 0) {
      const timer = setTimeout(() => {
        setRipples(current => current.slice(1));
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [ripples]);

  // Handle audio playback ended
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => setIsPlaying(false);
    }
  }, [audioBlob]);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {audioBlob && (
        <audio 
          ref={audioRef} 
          src={URL.createObjectURL(audioBlob)} 
          className="hidden"
        />
      )}
      
      <div className="relative flex items-center justify-center my-8">
        {/* Recording button and ripple effects */}
        <AnimatePresence>
          {ripples.map((id) => (
            <motion.div
              key={id}
              initial={{ scale: 0.5, opacity: 0.7 }}
              animate={{ scale: 2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="absolute rounded-full bg-primary/30"
              style={{ width: '100%', height: '100%' }}
            />
          ))}
        </AnimatePresence>
        
        <motion.button
          onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            "relative z-10 rounded-full flex items-center justify-center border transition-all duration-300 shadow-lg",
            isRecording 
              ? "bg-red-500 border-red-600 w-16 h-16" 
              : "bg-primary hover:bg-primary/90 border-primary/20 w-20 h-20"
          )}
          whileTap={{ scale: 0.95 }}
          animate={isRecording ? { scale: [1, 1.05, 1], transition: { repeat: Infinity, duration: 1.5 } } : {}}
        >
          {isRecording ? (
            <Square className="w-6 h-6 text-white" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </motion.button>
      </div>
      
      {/* Recording timer or playback controls */}
      <AnimatePresence mode="wait">
        {isRecording ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center"
          >
            <div className="flex items-center gap-2 text-red-500 font-medium">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span>Recording</span>
            </div>
            <p className="text-lg font-mono mt-1">{formatTime(recordingTime)}</p>
          </motion.div>
        ) : audioBlob ? (
          <motion.div 
            key="playback"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center gap-3"
          >
            <Button 
              onClick={togglePlayback} 
              variant="outline"
              className="rounded-full h-10 px-4 flex items-center gap-2"
            >
              {isPlaying ? (
                <>
                  <Square className="w-4 h-4" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Play Recording</span>
                </>
              )}
            </Button>
            
            <Button 
              onClick={() => {
                // Process the recording (in a real app, this would send to Whisper API)
                toast.success('Processing your recording...');
                setTimeout(() => {
                  toast.success('Entry saved!');
                  setAudioBlob(null);
                }, 2000);
              }}
              className="w-full mt-2 rounded-lg flex items-center justify-center gap-2"
            >
              <span>Save Entry</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </motion.div>
        ) : (
          <motion.p
            key="instruction"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center text-muted-foreground"
          >
            Tap the microphone to start recording
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VoiceRecorder;
