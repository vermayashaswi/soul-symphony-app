
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

  // Function to create audio processing setup for visualizations and noise reduction
  const setupAudioProcessing = useCallback((stream: MediaStream) => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Create analyzer node for visualization
      const analyzerNode = audioContext.createAnalyser();
      analyzerNode.fftSize = 256;
      analyzerRef.current = analyzerNode;
      
      // Create source from stream
      const source = audioContext.createMediaStreamSource(stream);
      
      // If noise reduction is enabled, add filtering
      if (noiseReduction) {
        // High-pass filter to remove low-frequency noise
        const highpassFilter = audioContext.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.value = 80;
        highpassFilter.Q.value = 0.7;
        
        // Low-pass filter to remove high-frequency noise
        const lowpassFilter = audioContext.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.value = 8000;
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
          const scaledLevel = Math.min(100, Math.max(0, avg * 1.5)); // Scale 0-255 to 0-100
          
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
  }, [noiseReduction, isRecording]);
  
  const startRecording = async () => {
    try {
      // Reset state
      setAudioBlob(null);
      setRecordingTime(0);
      chunksRef.current = [];
      
      // Request microphone permission with user interaction
      toast.loading('Accessing microphone...');
      
      // Enhanced media constraints for better recording quality
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      toast.dismiss();
      toast.success('Microphone accessed. Recording started!');
      
      // Save stream reference for cleanup
      streamRef.current = stream;
      
      // Set up audio processing
      setupAudioProcessing(stream);
      
      // Try to use the best available codec
      let options: MediaRecorderOptions = {};
      
      // Check what MIME types are supported to get the best quality
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
      
      // Create MediaRecorder with best available options
      console.log("Creating media recorder with options:", options);
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up data handling with more frequent data collection
      mediaRecorder.ondataavailable = (e) => {
        console.log("Data available event:", e.data.size, "bytes");
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      // Set up stop handler
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
        
        // Clean up resources
        cleanupResources();
        
        toast.success('Recording saved!');
      };
      
      // Start recording with more frequent data collection (every 500ms)
      mediaRecorder.start(500);
      setIsRecording(true);
      
      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Initial ripple
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
      
      // Clear ripples
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
