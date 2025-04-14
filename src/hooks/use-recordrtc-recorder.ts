import { useState, useCallback, useRef, useEffect } from 'react';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { useIsMobile } from '@/hooks/use-mobile';

interface RecordRTCOptions {
  noiseReduction?: boolean;
  maxDuration?: number;
}

export function useRecordRTCRecorder(options: RecordRTCOptions = {}) {
  const { isMobile } = useIsMobile();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [ripples, setRipples] = useState<number[]>([]);
  const [recorder, setRecorder] = useState<RecordRTC | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastLevelUpdateRef = useRef<number>(0);
  const { noiseReduction = true, maxDuration = 300 } = options;

  const normalizeVolume = useCallback(async (audioBlob: Blob): Promise<Blob> => {
    const audioContext = new AudioContext();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    let peakVolume = 0;
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      peakVolume = Math.max(peakVolume, Math.abs(channelData[i]));
    }

    const normalizationFactor = 1.0 / peakVolume;
    const normalizedBuffer = audioContext.createBuffer(
      1, // mono
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    const normalizedChannelData = normalizedBuffer.getChannelData(0);
    
    for (let i = 0; i < channelData.length; i++) {
      normalizedChannelData[i] = channelData[i] * normalizationFactor;
    }

    const offlineContext = new OfflineAudioContext(
      1, 
      audioBuffer.length, 
      audioBuffer.sampleRate
    );
    const source = offlineContext.createBufferSource();
    source.buffer = normalizedBuffer;
    source.connect(offlineContext.destination);
    source.start();
    const renderedBuffer = await offlineContext.startRendering();

    return new Promise((resolve) => {
      renderedBuffer.getChannelData(0);
      const writer = new MediaRecorder(new AudioContext().createMediaStreamDestination().stream);
      const chunks: Blob[] = [];
      
      writer.ondataavailable = (e) => chunks.push(e.data);
      writer.onstop = () => resolve(new Blob(chunks, { type: 'audio/webm' }));
      
      writer.start();
      const source = writer.stream.getAudioTracks()[0];
      source.stop();
      writer.stop();
    });
  }, []);

  const startRecording = useCallback(async () => {
    try {
      console.log('[useRecordRTCRecorder] Starting recording...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: noiseReduction,
          autoGainControl: true,
          sampleRate: 48000,
          sampleSize: 24,
          channelCount: 2
        }
      });

      console.log('[useRecordRTCRecorder] Microphone access granted');
      setStream(mediaStream);

      const recordOptions = {
        type: 'audio',
        mimeType: 'audio/webm;codecs=opus',
        recorderType: StereoAudioRecorder,
        numberOfAudioChannels: 2,
        desiredSampRate: 48000,
        checkForInactiveTracks: true,
        timeSlice: isMobile ? 1000 : 2000,
        audioBitsPerSecond: 128000,
        ondataavailable: (blob: Blob) => {
          console.log(`[useRecordRTCRecorder] Data available: ${blob.size} bytes`);
          if (blob.size > 0) {
            setAudioBlob(blob);
          }
        }
      };

      console.log('[useRecordRTCRecorder] Creating recorder with options:', recordOptions);
      const rtcRecorder = new RecordRTC(mediaStream, recordOptions);
      rtcRecorder.startRecording();
      console.log('[useRecordRTCRecorder] Recording started');
      
      setRecorder(rtcRecorder);
      setIsRecording(true);
      setAudioBlob(null);
      setRecordingTime(0);
      startTimeRef.current = Date.now();
      lastLevelUpdateRef.current = Date.now();
      setRipples([]);

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(mediaStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const updateAudioLevel = () => {
        if (!isRecording) return;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setAudioLevel(average);

        const now = Date.now();
        if (now - lastLevelUpdateRef.current > 100) {
          setRipples(prev => {
            const newRipples = [...prev, average];
            if (newRipples.length > 10) {
              newRipples.shift();
            }
            return newRipples;
          });
          lastLevelUpdateRef.current = now;
        }

        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();
    } catch (error: any) {
      console.error("[useRecordRTCRecorder] Error starting recording:", error);
      setIsRecording(false);
      setHasPermission(false);
    }
  }, [noiseReduction, isMobile, isRecording]);

  const stopRecording = useCallback(async () => {
    if (!recorder) {
      console.warn('[useRecordRTCRecorder] No recorder to stop');
      return;
    }

    try {
      console.log('[useRecordRTCRecorder] Stopping recording...');
      
      const audioData = await new Promise<Blob>((resolve) => {
        recorder.stopRecording(() => {
          const blob = recorder.getBlob();
          console.log(`[useRecordRTCRecorder] Recording stopped, got blob: ${blob.size} bytes, type: ${blob.type}`);
          resolve(blob);
        });
      });
      
      setIsRecording(false);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (stream) {
        stream.getTracks().forEach(track => {
          console.log(`[useRecordRTCRecorder] Stopping track: ${track.kind}`);
          track.stop();
        });
        setStream(null);
      }

      if (audioData.size === 0) {
        console.warn('[useRecordRTCRecorder] Empty audio blob, creating minimal placeholder');
        const silence = new Uint8Array(1024).fill(0);
        const placeholderBlob = new Blob([silence], { type: 'audio/webm;codecs=opus' });
        setAudioBlob(placeholderBlob);
      } else {
        console.log('[useRecordRTCRecorder] Setting audio blob:', audioData.size, audioData.type);
        setAudioBlob(audioData);
      }
      
      setRecorder(null);
    } catch (error) {
      console.error("[useRecordRTCRecorder] Error stopping recording:", error);
      setIsRecording(false);
      setRecorder(null);
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  }, [recorder, stream]);

  const resetRecording = useCallback(() => {
    setIsRecording(false);
    setAudioBlob(null);
    setRecordingTime(0);
    setAudioLevel(0);
    setRipples([]);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (recorder) {
      recorder.destroy();
      setRecorder(null);
    }
  }, [recorder, stream]);

  const requestPermissions = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error("Permission denied:", error);
      setHasPermission(false);
    }
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isRecording) {
      intervalId = setInterval(() => {
        const elapsedTime = Date.now() - startTimeRef.current;
        if (elapsedTime >= maxDuration * 1000) {
          stopRecording();
          clearInterval(intervalId!);
        } else {
          setRecordingTime(Math.floor(elapsedTime / 1000));
        }
      }, 1000);
    } else {
      if (intervalId) {
        clearInterval(intervalId);
      }
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRecording, maxDuration, stopRecording]);

  return {
    isRecording,
    recordingTime,
    audioBlob,
    audioLevel,
    hasPermission,
    ripples,
    startRecording,
    stopRecording,
    resetRecording,
    requestPermissions,
    normalizeVolume
  };
}
