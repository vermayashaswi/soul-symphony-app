import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface UseVoiceRecorderOptions {
  noiseReduction?: boolean;
  maxDuration?: number; // Add option for max recording duration
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

export function useVoiceRecorder({ 
  noiseReduction = true,
  maxDuration = 300 // 5 minutes maximum by default
}: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
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

  // Function to create audio processing setup for visualizations and noise reduction
  const setupAudioProcessing = (stream: MediaStream) => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Create analyzer node for visualization
      const analyzerNode = audioContext.createAnalyser();
      analyzerNode.fftSize = 1024; // Increased for better frequency resolution
      analyzerRef.current = analyzerNode;
      
      // Create source from stream
      const source = audioContext.createMediaStreamSource(stream);
      
      // If noise reduction is enabled, add filtering
      if (noiseReduction) {
        // High-pass filter to remove low-frequency noise
        const highpassFilter = audioContext.createBiquadFilter();
        highpassFilter.type = 'highpass';
        highpassFilter.frequency.value = 100; // Increased from 80 for better voice clarity
        highpassFilter.Q.value = 0.7;
        
        // Low-pass filter to remove high-frequency noise
        const lowpassFilter = audioContext.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.value = 12000; // Increased to capture more vocal details
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
          
          // Detect silence (potentially paused recording)
          if (isRecording && avg < 5) {
            console.log('Low audio level detected: ' + avg);
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
      chunksRef.current = [];
      
      // Request microphone permission with user interaction
      toast.loading('Accessing microphone...');
      
      // Enhanced media constraints for better recording quality
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Use higher sample rate for better quality
          sampleRate: 48000,
          // Try to use higher bit depth
          sampleSize: 24, // Increased from 16 for better audio quality
          // Use stereo if available
          channelCount: 2,
        } 
      });
      
      toast.dismiss();
      toast.success('Microphone accessed. Recording started!');
      
      // Save stream reference for cleanup
      streamRef.current = stream;
      
      // Set up audio processing
      setupAudioProcessing(stream);
      
      // Check the platform/browser to determine the optimal settings
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // Options for MediaRecorder, prioritizing compatibility
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
      ];
      
      // Find the first supported MIME type
      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          console.log(`Using media recorder MIME type: ${type}`);
          break;
        }
      }
      
      // Fall back to audio/webm if no supported type is found
      if (!selectedMimeType) {
        console.log('No supported MIME type found, using browser default');
        selectedMimeType = '';
      }
      
      // Create MediaRecorder with best available options and higher bitrate
      const options: MediaRecorderOptions = {
        bitsPerSecond: 256000 // 256 kbps for much better audio quality (increased from 128)
      };
      
      if (selectedMimeType) {
        options.mimeType = selectedMimeType;
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up data handling with more frequent data collection
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          console.log(`Recorded chunk: ${e.data.size} bytes`);
        }
      };
      
      // Set up stop handler
      mediaRecorder.onstop = () => {
        if (chunksRef.current.length === 0) {
          toast.error('No audio data recorded. Please try again.');
          setAudioBlob(null);
          return;
        }
        
        // Log chunk information
        console.log(`Recording stopped, got ${chunksRef.current.length} chunks`);
        let totalSize = 0;
        chunksRef.current.forEach((chunk, i) => {
          console.log(`Chunk ${i}: size=${chunk.size}, type=${chunk.type}`);
          totalSize += chunk.size;
        });
        console.log(`Total audio size: ${totalSize} bytes`);
        
        // Create a blob with the correct mime type
        const blob = new Blob(chunksRef.current, { type: selectedMimeType || 'audio/webm' });
        console.log('Recording stopped, blob size:', blob.size, 'blob type:', blob.type);
        setAudioBlob(blob);
        
        // Clean up resources
        cleanupResources();
        
        toast.success('Recording saved!');
      };
      
      // Start recording with more frequent data collection (every 100ms for better chunking)
      setIsRecording(true);
      mediaRecorder.start(100); // Reduced from 250ms to capture more detail
      
      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Set up max duration timeout
      if (maxDuration > 0) {
        maxDurationTimerRef.current = window.setTimeout(() => {
          if (isRecording && mediaRecorderRef.current) {
            console.log(`Max recording duration of ${maxDuration}s reached, stopping automatically`);
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
    if (mediaRecorderRef.current && isRecording) {
      console.log("Stopping recording...");
      try {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        
        // Clear ripples
        setRipples([]);
        
        // Clear max duration timer if it exists
        if (maxDurationTimerRef.current) {
          clearTimeout(maxDurationTimerRef.current);
          maxDurationTimerRef.current = null;
        }
      } catch (error) {
        console.error("Error stopping recording:", error);
        toast.error("Error stopping recording. Please refresh and try again.");
      }
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
