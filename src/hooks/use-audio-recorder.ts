import { useState, useRef, useEffect, useCallback } from 'react';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { normalizeAudioBlob } from '@/utils/audio/blob-utils';
import { useMicrophonePermission } from './use-microphone-permission';

interface UseAudioRecorderOptions {
  maxDuration?: number; // in seconds
  noiseReduction?: boolean;
}

export function useAudioRecorder({
  maxDuration = 300, // 5 minutes default
  noiseReduction = true
}: UseAudioRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [ripples, setRipples] = useState<number[]>([]);
  
  const {
    permission: micPermission,
    isSupported: micSupported,
    requestPermission: requestMicPermission
  } = useMicrophonePermission();

  const recorderRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clean up function to release resources
  const cleanupResources = useCallback(() => {
    // Stop all animation frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Clear timer interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    // Clear max duration timeout
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }

    // Stop audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
    }

    // Stop recorder
    if (recorderRef.current) {
      recorderRef.current.stopRecording();
      recorderRef.current = null;
    }

    // Stop and release media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Set up cleanup on unmount
  useEffect(() => {
    return cleanupResources;
  }, [cleanupResources]);

  // Request microphone permissions
  const requestPermissions = useCallback(async () => {
    try {
      // Always clean up previous resources first
      cleanupResources();
      
      // Use the microphone permission hook for native apps
      const hasNativePermission = await requestMicPermission();
      if (!hasNativePermission) {
        return false;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: noiseReduction,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 44100
        }
      });
      
      streamRef.current = stream;
      return true;
    } catch (error) {
      console.error('[useAudioRecorder] Error requesting permissions:', error);
      return false;
    }
  }, [noiseReduction, cleanupResources, requestMicPermission]);

  // Start analyzing audio levels
  const startAudioAnalysis = useCallback(() => {
    if (!streamRef.current) return;
    
    try {
      // Create audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      // Create analyzer
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // Connect stream to analyzer
      const source = audioContext.createMediaStreamSource(streamRef.current);
      source.connect(analyser);
      
      // Set up data array for analyzer
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      // Create animation loop to analyze audio levels
      const analyzeAudio = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setAudioLevel(average);
        
        // Add ripples for visual effect
        if (average > 30) {
          const time = Date.now();
          if (ripples.length === 0 || time - ripples[ripples.length - 1] > 100) {
            setRipples(prev => [...prev, time]);
          }
        }
        
        // Clean up ripples older than 2 seconds
        setRipples(prev => prev.filter(time => Date.now() - time < 2000));
        
        // Continue animation loop
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      };
      
      // Start animation loop
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    } catch (error) {
      console.error('[useAudioRecorder] Error setting up audio analysis:', error);
    }
  }, [ripples]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (isRecording) return;
    
    try {
      // Request permissions if not already granted
      if (micPermission !== 'granted') {
        const permissionGranted = await requestPermissions();
        if (!permissionGranted) {
          throw new Error('Microphone permission denied');
        }
      }
      
      // Make sure we have a stream
      if (!streamRef.current) {
        await requestPermissions();
      }
      
      if (!streamRef.current) {
        throw new Error('Failed to get audio stream');
      }
      
      // Reset state
      setAudioBlob(null);
      setRecordingTime(0);
      startTimeRef.current = Date.now();
      
      // Configure RecordRTC options
      const options = {
        type: 'audio',
        mimeType: 'audio/webm;codecs=opus',
        recorderType: StereoAudioRecorder,
        numberOfAudioChannels: 1,
        desiredSampRate: 44100,
        checkForInactiveTracks: true,
        timeSlice: 50, // Record in smaller chunks
      };
      
      // Create and start recorder
      const recorder = new RecordRTC(streamRef.current, options);
      recorderRef.current = recorder;
      recorder.startRecording();
      
      // Start audio analysis
      startAudioAnalysis();
      
      // Set up timer for recording duration
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setRecordingTime(elapsed);
      }, 100);
      
      // Set up timeout for max duration
      if (maxDuration > 0) {
        maxDurationTimeoutRef.current = setTimeout(() => {
          if (isRecording) {
            stopRecording();
          }
        }, maxDuration * 1000);
      }
      
      setIsRecording(true);
    } catch (error) {
      console.error('[useAudioRecorder] Error starting recording:', error);
      cleanupResources();
    }
  }, [isRecording, micPermission, requestPermissions, cleanupResources, startAudioAnalysis, maxDuration]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!isRecording || !recorderRef.current) return;
    
    try {
      setIsRecording(false);
      
      // Clear timer interval
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      // Clear max duration timeout
      if (maxDurationTimeoutRef.current) {
        clearTimeout(maxDurationTimeoutRef.current);
        maxDurationTimeoutRef.current = null;
      }
      
      // Stop animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Calculate final duration
      const finalDuration = (Date.now() - startTimeRef.current) / 1000;
      
      // Stop recorder and get blob
      recorderRef.current.stopRecording(async () => {
        const blob = recorderRef.current?.getBlob();
        
        if (blob) {
          // Add duration property to blob
          try {
            Object.defineProperty(blob, 'duration', {
              value: finalDuration,
              writable: false,
              enumerable: true
            });
            
            console.log(`[useAudioRecorder] Recording stopped. Duration: ${finalDuration}s, Size: ${blob.size} bytes, Type: ${blob.type}`);
            setAudioBlob(blob);
          } catch (error) {
            console.error('[useAudioRecorder] Error adding duration to blob:', error);
            setAudioBlob(blob);
          }
        }
        
        // Release resources but keep stream for potential reuse
        if (recorderRef.current) {
          recorderRef.current = null;
        }
      });
    } catch (error) {
      console.error('[useAudioRecorder] Error stopping recording:', error);
      cleanupResources();
    }
  }, [isRecording, cleanupResources]);

  // Reset recording state
  const resetRecording = useCallback(() => {
    cleanupResources();
    setAudioBlob(null);
    setRecordingTime(0);
    setAudioLevel(0);
    setRipples([]);
  }, [cleanupResources]);

  return {
    isRecording,
    recordingTime,
    audioBlob,
    audioLevel,
    hasPermission: micPermission === 'granted',
    ripples,
    startRecording,
    stopRecording,
    requestPermissions,
    resetRecording
  };
}
