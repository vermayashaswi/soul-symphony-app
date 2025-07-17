import { useState, useEffect } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

export type MicrophonePermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export const useMicrophonePermission = () => {
  const [permission, setPermission] = useState<MicrophonePermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      // Check if running natively first
      if (nativeIntegrationService.isRunningNatively()) {
        try {
          // Try to use native permissions API
          const result = await nativeIntegrationService.requestPermissions(['microphone']);
          if (result && result.microphone) {
            setIsSupported(true);
            setPermission(result.microphone === 'granted' ? 'granted' : 'denied');
            return;
          }
        } catch (error) {
          console.error('Error checking native microphone permission:', error);
        }
      }

      // Fallback to web API
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        setIsSupported(true);
        // For web, we can't check permission without requesting it
        setPermission('default');
      } else {
        setIsSupported(false);
        setPermission('unsupported');
      }
    };

    checkPermission();
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      console.log('Microphone not supported');
      return false;
    }

    if (permission === 'granted') {
      return true;
    }

    try {
      // Try native first if available
      if (nativeIntegrationService.isRunningNatively()) {
        const result = await nativeIntegrationService.requestPermissions(['microphone']);
        if (result && result.microphone) {
          const granted = result.microphone === 'granted';
          setPermission(granted ? 'granted' : 'denied');
          return granted;
        }
      }

      // Fallback to web API - request access to test permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Clean up
        setPermission('granted');
        return true;
      } catch (error: any) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setPermission('denied');
          return false;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      setPermission('denied');
      return false;
    }
  };

  const isGranted = permission === 'granted';
  const isDenied = permission === 'denied';
  const isDefault = permission === 'default';

  return {
    permission,
    isSupported,
    isGranted,
    isDenied,
    isDefault,
    requestPermission
  };
};