import { useState, useRef, useEffect } from 'react';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { toast } from 'sonner';

interface UseRecordRTCRecorderOptions {
  noiseReduction?: boolean;
  maxDuration?: number;
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
}

export function useRecordRTCRecorder({ 
  noiseReduction = false,
  maxDuration = 300
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
  
  // Check for microphone permission on component mount
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately after checking permission
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
      } catch (error) {
        console.error('Microphone permission error:', error);
        setHasPermission(false);
      }
    };
    
    checkMicPermission();
    
    // Cleanup function
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

  // Setup audio processing for visualization and noise reduction
  const setupAudioProcessing = (stream: MediaStream) => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Create analyzer node for visualization
      const analyzerNode = audioContext.createAnalyser();
      analyzerNode.fftSize = 1024;
      analyzerRef.current = analyzerNode;
      
      // Create source from stream
      const source = audioContext.createMediaStreamSource(stream);
      
      // If noise reduction is enabled, add filtering
      if (noiseReduction) {
        // High-pass filter to remove low-frequency noise
        const highpassFilter = audioContext.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.value = 100;
        highpassFilter.Q.value = 0.7;
        
        // Low-pass filter to remove high-frequency noise
        const lowpassFilter = audioContext.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.value = 12000;
        lowpassFilter.Q.value = 0.7;
        
        // Compressor to normalize volume
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        
        // Connect the nodes
        source.connect(highpassFilter);
        highpassFilter.connect(lowpassFilter);
        lowpassFilter.connect(compressor);
        compressor.connect(analyzerNode);
      } else {
        // Simple connection without filtering
        source.connect(analyzerNode);
      }
      
      // Start monitoring audio levels
      const dataArray = new Uint8Array(analyzerNode.frequencyBinCount);
      
      audioLevelTimerRef.current = window.setInterval(() => {
        if (analyzerRef.current) {
          analyzerRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average volume level
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const scaledLevel = Math.min(100, Math.max(0, avg * 1.5));
          
          setAudioLevel(scaledLevel);
          
          // Add ripple based on audio level
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
  };
  
  const startRecording = async () => {
    try {
      // Reset state
      setAudioBlob(null);
      setRecordingTime(0);
      
      toast.loading('Accessing microphone...');
      
      // Get user media with optimized constraints for mobile
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Higher quality settings
          sampleRate: 48000,
          sampleSize: 24,
          channelCount: 2,
        }
      });
      
      toast.dismiss();
      toast.success('Microphone accessed. Recording started!');
      
      // Save stream reference
      streamRef.current = stream;
      
      // Set up audio processing for visualization
      setupAudioProcessing(stream);
      
      // Detect mobile platform
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // Configure RecordRTC with optimal settings
      const options = {
        type: 'audio',
        mimeType: 'audio/webm;codecs=opus', // Best compatibility and quality
        recorderType: StereoAudioRecorder,
        numberOfAudioChannels: 2, // Stereo
        desiredSampRate: 48000, // High-quality sample rate
        bufferSize: 16384, // Larger buffer for better quality
        checkForInactiveTracks: true,
        disableLogs: false,
        // Special settings for mobile
        timeSlice: isMobile ? 1000 : 2000, // More frequent data handling on mobile
      };
      
      // Create RecordRTC instance
      recorderRef.current = new RecordRTC(stream, options);
      
      // Start recording
      recorderRef.current.startRecording();
      setIsRecording(true);
      
      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Set up max duration timeout
      if (maxDuration > 0) {
        maxDurationTimerRef.current = window.setTimeout(() => {
          if (isRecording && recorderRef.current) {
            console.log(`Max recording duration reached (${maxDuration}s), stopping automatically`);
            stopRecording();
          }
        }, maxDuration * 1000);
      }
      
      // Initial ripple
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
        
        // Clear ripples
        setRipples([]);
        
        // Cleanup resources but keep the blob
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

  // Manage ripples lifecycle
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
    requestPermissions
  };
}
