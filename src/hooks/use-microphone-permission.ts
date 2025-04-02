
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface UseMicrophonePermissionReturn {
  hasPermission: boolean | null;
  requestPermission: () => Promise<boolean>;
}

export function useMicrophonePermission(): UseMicrophonePermissionReturn {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

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
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    try {
      toast.loading('Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      toast.dismiss();
      toast.success('Microphone permission granted!');
      return true;
    } catch (error) {
      console.error('Failed to get permission:', error);
      toast.dismiss();
      toast.error('Microphone permission denied. Please adjust your browser settings.');
      return false;
    }
  };

  return {
    hasPermission,
    requestPermission
  };
}
