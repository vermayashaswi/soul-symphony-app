
import { useMobile } from '@/hooks/use-mobile';

export const RECORDING_LIMITS = {
  MAX_DURATION: 300, // 5 minutes in seconds
  MIN_DURATION: 0.5, // 0.5 seconds minimum for processing
};

export function getAudioConfig() {
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  const baseConfig = {
    echoCancellation: true,
    noiseSuppression: false, // Changed from true to false
    autoGainControl: true,
  };

  if (isIOS) {
    return {
      ...baseConfig,
      sampleRate: 44100,
      sampleSize: 16,
      channelCount: 1,
      mimeType: 'audio/wav',
    };
  }

  // Android and other platforms
  return {
    ...baseConfig,
    sampleRate: 48000,
    sampleSize: 16,
    channelCount: 1,
    mimeType: 'audio/webm',
  };
}

export function getRecorderOptions(platform: 'ios' | 'android' | 'web' = 'web') {
  const baseOptions = {
    type: 'audio',
    recorderType: null,
    timeSlice: 1000,
    checkForInactiveTracks: true,
    disableLogs: false,
  };

  switch (platform) {
    case 'ios':
      return {
        ...baseOptions,
        mimeType: 'audio/wav',
        numberOfAudioChannels: 1,
        desiredSampRate: 44100,
        audioBitsPerSecond: 128000,
        noiseSuppression: false, // Added explicit noise suppression setting
      };
    case 'android':
      return {
        ...baseOptions,
        mimeType: 'audio/webm',
        numberOfAudioChannels: 1,
        desiredSampRate: 48000,
        audioBitsPerSecond: 192000,
        noiseSuppression: false, // Added explicit noise suppression setting
      };
    default:
      return {
        ...baseOptions,
        mimeType: 'audio/webm',
        numberOfAudioChannels: 1,
        desiredSampRate: 48000,
        audioBitsPerSecond: 192000,
        noiseSuppression: false, // Added explicit noise suppression setting
      };
  }
}
