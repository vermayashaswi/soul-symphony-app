import { useState } from 'react';
import { useMicrophonePermission } from './use-microphone-permission';
import { useAudioVisualization } from './use-audio-visualization';
import { useAudioRecorder } from './use-audio-recorder';

interface UseVoiceRecorderOptions {
  noiseReduction?: boolean;
  maxDuration?: number;
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
  noiseReduction = false,
  maxDuration = 300
}: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
  const [initialRipple, setInitialRipple] = useState<boolean>(false);

  const { hasPermission, requestPermission } = useMicrophonePermission();
  
  const {
    isRecording,
    recordingTime,
    audioBlob,
    stream,
    startRecording,
    stopRecording
  } = useAudioRecorder({ maxDuration });
  
  const { audioLevel, ripples } = useAudioVisualization({ 
    stream, 
    isRecording
  });

  const enhancedStartRecording = async () => {
    await startRecording();
    if (!initialRipple) {
      setInitialRipple(true);
    }
  };

  const requestPermissions = async () => {
    await requestPermission();
  };

  return {
    isRecording,
    recordingTime,
    audioBlob,
    audioLevel,
    hasPermission,
    ripples,
    startRecording: enhancedStartRecording,
    stopRecording,
    requestPermissions
  };
}
