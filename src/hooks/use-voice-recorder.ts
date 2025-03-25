import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface UseVoiceRecorderOptions {
  noiseReduction?: boolean;
}

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  audioLevel: number;
  hasPermission: boolean | null;
  ripples: number[];
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  requestPermissions: () => Promise<void>;
  resetRecording: () => void;
}

export function useVoiceRecorder({ noiseReduction = true }: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [ripples, setRipples] = useState<number[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioLevelTimerRef = useRef<number | null>(null);
  
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
      } catch (error) {
        console.error('Microphone permission error:', error);
        setHasPermission(false);
      }
    };
    
    checkMicPermission();
    
    return () => {
      cleanupResources();
    };
  }, []);
  
  const cleanupResources = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioLevelTimerRef.current) {
      clearInterval(audioLevelTimerRef.current);
      audioLevelTimerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
  }, []);

  const setupAudioProcessing = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const analyzerNode = audioContext.createAnalyser();
      analyzerNode.fftSize = 256;
      analyzerRef.current = analyzerNode;
      
      const source = audioContext.createMediaStreamSource(stream);
      
      if (noiseReduction) {
        const highpassFilter = audioContext.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.value = 80;
        highpassFilter.Q.value = 0.7;
        
        const lowpassFilter = audioContext.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.value = 8000;
        lowpassFilter.Q.value = 0.7;
        
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        
        source.connect(highpassFilter);
        highpassFilter.connect(lowpassFilter);
        lowpassFilter.connect(compressor);
        compressor.connect(analyzerNode);
      } else {
        source.connect(analyzerNode);
      }
      
      const dataArray = new Uint8Array(analyzerNode.frequencyBinCount);
      
      audioLevelTimerRef.current = window.setInterval(() => {
        if (analyzerRef.current) {
          analyzerRef.current.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const scaledLevel = Math.min(100, Math.max(0, avg * 1.5));
          
          setAudioLevel(scaledLevel);
          
          if (isRecording && avg > 50 && Math.random() > 0.7) {
            setRipples(prev => [...prev, Date.now()]);
          }
        }
      }, 100);
      
      return audioContext;
    } catch (error) {
      console.error('Error setting up audio processing:', error);
      return null;
    }
  }, [noiseReduction, isRecording]);
  
  const startRecording = async () => {
    try {
      setAudioBlob(null);
      setRecordingTime(0);
      chunksRef.current = [];
      
      toast.loading('Accessing microphone...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      toast.dismiss();
      toast.success('Microphone accessed. Recording started!');
      
      streamRef.current = stream;
      
      setupAudioProcessing(stream);
      
      let options: MediaRecorderOptions = {};
      
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
      ];
      
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          options.mimeType = type;
          console.log(`Using media recorder MIME type: ${type}`);
          break;
        }
      }
      
      console.log("Creating media recorder with options:", options);
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        console.log("Data available event:", e.data.size, "bytes");
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log("Media recorder stopped");
        console.log("Chunks collected:", chunksRef.current.length);
        
        if (chunksRef.current.length === 0) {
          toast.error('No audio data recorded. Please try again.');
          setAudioBlob(null);
          return;
        }
        
        const blob = new Blob(chunksRef.current, { type: options.mimeType || 'audio/webm' });
        console.log('Recording stopped, blob size:', blob.size, 'type:', blob.type);
        setAudioBlob(blob);
        
        cleanupResources();
        
        toast.success('Recording saved!');
      };
      
      mediaRecorder.start(500);
      setIsRecording(true);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      setRipples([Date.now()]);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.dismiss();
      toast.error('Could not access microphone. Please check permissions and try again.');
      setHasPermission(false);
    }
  };

  const stopRecording = useCallback(() => {
    console.log("Stopping recording, mediaRecorder state:", mediaRecorderRef.current?.state);
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      setRipples([]);
    }
  }, [isRecording]);
  
  const requestPermissions = async () => {
    try {
      toast.loading('Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      toast.dismiss();
      toast.success('Microphone permission granted!');
    } catch (error) {
      console.error('Failed to get permission:', error);
      toast.dismiss();
      toast.error('Microphone permission denied. Please adjust your browser settings.');
      setHasPermission(false);
    }
  };

  const resetRecording = () => {
    if (isRecording) {
      stopRecording();
    }
    
    setAudioBlob(null);
    setRecordingTime(0);
    chunksRef.current = [];
  };

  useEffect(() => {
    if (ripples.length > 0) {
      const timer = setTimeout(() => {
        setRipples(current => current.slice(1));
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [ripples]);

  return {
    isRecording,
    recordingTime,
    audioBlob,
    audioLevel,
    hasPermission,
    ripples,
    startRecording,
    stopRecording,
    requestPermissions,
    resetRecording
  };
}
