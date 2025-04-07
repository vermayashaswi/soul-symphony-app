import { useState, useRef, useEffect } from 'react';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { toast } from 'sonner';

interface UseRecordRTCRecorderOptions {
  noiseReduction?: boolean;
  maxDuration?: number;
  onAudioLevelChange?: (level: number) => void;
}

interface UseRecordRTCRecorderReturn {
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

export function useRecordRTCRecorder({ 
  noiseReduction = false,
  maxDuration = 300,
  onAudioLevelChange
}: UseRecordRTCRecorderOptions = {}): UseRecordRTCRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [ripples, setRipples] = useState<number[]>([]);
  
  const recorderRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioLevelTimerRef = useRef<number | null>(null);
  const maxDurationTimerRef = useRef<number | null>(null);
  
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
  
  const cleanupResources = () => {
    if (recorderRef.current) {
      recorderRef.current.destroy();
      recorderRef.current = null;
    }
    
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
    
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      audioContextRef.current = null;
    }
  };

  const setupAudioProcessing = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const analyzerNode = audioContext.createAnalyser();
      analyzerNode.fftSize = 1024;
      analyzerRef.current = analyzerNode;
      
      const source = audioContext.createMediaStreamSource(stream);
      
      if (noiseReduction) {
        const highpassFilter = audioContext.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.value = 100;
        highpassFilter.Q.value = 0.7;
        
        const lowpassFilter = audioContext.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.value = 12000;
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
          const scaledLevel = Math.min(100, Math.max(0, avg * 2.5));
          
          setAudioLevel(scaledLevel);
          
          if (onAudioLevelChange) {
            onAudioLevelChange(scaledLevel);
          }
          
          if (Date.now() % 2000 < 100) {
            console.log(`[useRecordRTCRecorder] Audio level: ${scaledLevel.toFixed(2)}`);
          }
          
          if (isRecording) {
            if (scaledLevel > 15) {
              const probability = (scaledLevel / 100) * 0.7;
              if (Math.random() < probability) {
                setRipples(prev => [...prev, Date.now()]);
              }
            }
          }
        }
      }, 50);
      
      return audioContext;
    } catch (error) {
      console.error('Error setting up audio processing:', error);
      return null;
    }
  };
  
  const startRecording = async () => {
    try {
      setAudioBlob(null);
      setRecordingTime(0);
      
      toast.loading('Accessing microphone...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          sampleSize: 24,
          channelCount: 2,
        }
      });
      
      toast.dismiss();
      toast.success('Microphone accessed. Recording started!');
      
      streamRef.current = stream;
      
      setupAudioProcessing(stream);
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      const options = {
        type: 'audio',
        mimeType: 'audio/webm;codecs=opus',
        recorderType: StereoAudioRecorder,
        numberOfAudioChannels: 2,
        desiredSampRate: 48000,
        bufferSize: 16384,
        checkForInactiveTracks: true,
        disableLogs: false,
        timeSlice: isMobile ? 1000 : 2000,
      };
      
      recorderRef.current = new RecordRTC(stream, options);
      
      recorderRef.current.startRecording();
      setIsRecording(true);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      if (maxDuration > 0) {
        maxDurationTimerRef.current = window.setTimeout(() => {
          if (isRecording && recorderRef.current) {
            console.log(`Max recording duration reached (${maxDuration}s), stopping automatically`);
            stopRecording();
          }
        }, maxDuration * 1000);
      }
      
      setRipples([Date.now()]);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.dismiss();
      toast.error('Could not access microphone. Please check permissions and try again.');
      setHasPermission(false);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && isRecording) {
      console.log("Stopping recording...");
      
      recorderRef.current.stopRecording(() => {
        console.log("Recording stopped, generating blob...");
        const blob = recorderRef.current!.getBlob();
        console.log("Recording blob created:", blob.type, blob.size, "bytes");
        
        setAudioBlob(blob);
        setIsRecording(false);
        
        setRipples([]);
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        if (audioLevelTimerRef.current) {
          clearInterval(audioLevelTimerRef.current);
          audioLevelTimerRef.current = null;
        }
        
        if (maxDurationTimerRef.current) {
          clearTimeout(maxDurationTimerRef.current);
          maxDurationTimerRef.current = null;
        }
        
        toast.success('Recording saved!');
      });
    }
  };
  
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
    }
  };

  const resetRecording = () => {
    cleanupResources();
    setAudioBlob(null);
    setRecordingTime(0);
    setAudioLevel(0);
    setRipples([]);
  };

  useEffect(() => {
    if (ripples.length > 0) {
      const timer = setTimeout(() => {
        setRipples(current => current.slice(1));
      }, 1500);
      
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
