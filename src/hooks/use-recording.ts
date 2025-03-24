
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface UseRecordingReturnType {
  isRecording: boolean;
  audioBlob: Blob | null;
  recordingTime: number;
  startRecording: () => void;
  stopRecording: () => void;
  resetRecording: () => void;
  isProcessing: boolean;
  audioUrl: string | null;
}

export function useRecording(): UseRecordingReturnType {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Stop any active recording
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Clear any active timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Revoke object URL if it exists
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      setIsProcessing(true);
      
      // Reset state
      setAudioBlob(null);
      setRecordingTime(0);
      chunksRef.current = [];
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Save stream reference for cleanup
      streamRef.current = stream;
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up data handling
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      // Set up stop handler
      mediaRecorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          setAudioBlob(blob);
          
          // Create URL for audio playback
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
        }
        
        // Stop and release the stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        setIsProcessing(false);
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setIsProcessing(false);
      
      // Start timer to track recording duration
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone. Please check permissions and try again.');
      setIsProcessing(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const resetRecording = () => {
    // Clear recorded audio
    setAudioBlob(null);
    setRecordingTime(0);
    
    // Revoke object URL if it exists
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    
    // Ensure recording is stopped
    if (isRecording) {
      stopRecording();
    }
  };

  return {
    isRecording,
    audioBlob,
    recordingTime,
    startRecording,
    stopRecording,
    resetRecording,
    isProcessing,
    audioUrl
  };
}
