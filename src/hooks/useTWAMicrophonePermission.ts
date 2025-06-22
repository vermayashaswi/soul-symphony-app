
import { useState, useEffect, useCallback } from 'react';
import { 
  checkTWAMicrophonePermission, 
  requestTWAMicrophonePermission, 
  openTWAAppSettings,
  isSecureContext,
  getPermissionStatusMessage,
  TWAPermissionResult 
} from '@/utils/twaPermissions';
import { detectTWAEnvironment } from '@/utils/twaDetection';
import { toast } from 'sonner';

interface UseTWAMicrophonePermissionReturn {
  permissionStatus: TWAPermissionResult | null;
  isCheckingPermission: boolean;
  isRequestingPermission: boolean;
  hasPermission: boolean;
  canRequest: boolean;
  requiresSettings: boolean;
  checkPermission: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  openSettings: () => void;
  getStatusMessage: () => string;
}

export function useTWAMicrophonePermission(): UseTWAMicrophonePermissionReturn {
  const [permissionStatus, setPermissionStatus] = useState<TWAPermissionResult | null>(null);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  
  const twaEnv = detectTWAEnvironment();

  const checkPermission = useCallback(async () => {
    if (isCheckingPermission) return;
    
    setIsCheckingPermission(true);
    
    try {
      // Check if we're in a secure context first
      if (!isSecureContext()) {
        console.warn('[useTWAMicrophonePermission] Not in secure context');
        setPermissionStatus({
          status: 'unavailable',
          canRequest: false,
          requiresSettings: false,
          message: 'Microphone access requires a secure connection (HTTPS)'
        });
        return;
      }

      console.log('[useTWAMicrophonePermission] Checking microphone permission...');
      const result = await checkTWAMicrophonePermission();
      console.log('[useTWAMicrophonePermission] Permission check result:', result);
      
      setPermissionStatus(result);
      
      // Show appropriate toast message
      if (result.status === 'denied' && result.requiresSettings) {
        toast.error(result.message || 'Microphone access is blocked', {
          duration: 5000,
          action: {
            label: 'Open Settings',
            onClick: openSettings
          }
        });
      }
      
    } catch (error) {
      console.error('[useTWAMicrophonePermission] Error checking permission:', error);
      setPermissionStatus({
        status: 'unavailable',
        canRequest: false,
        requiresSettings: false,
        message: 'Failed to check microphone permission'
      });
    } finally {
      setIsCheckingPermission(false);
    }
  }, [isCheckingPermission]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isRequestingPermission) return false;
    
    setIsRequestingPermission(true);
    
    try {
      console.log('[useTWAMicrophonePermission] Requesting microphone permission...');
      const result = await requestTWAMicrophonePermission();
      console.log('[useTWAMicrophonePermission] Permission request result:', result);
      
      setPermissionStatus(result);
      
      if (result.status === 'granted') {
        toast.success('Microphone access granted!');
        return true;
      } else if (result.status === 'denied') {
        if (result.requiresSettings) {
          toast.error(result.message || 'Please enable microphone in settings', {
            duration: 8000,
            action: {
              label: 'Open Settings',
              onClick: openSettings
            }
          });
        } else {
          toast.error(result.message || 'Microphone access denied');
        }
        return false;
      } else {
        toast.error(result.message || 'Failed to request microphone access');
        return false;
      }
      
    } catch (error) {
      console.error('[useTWAMicrophonePermission] Error requesting permission:', error);
      toast.error('Failed to request microphone permission');
      return false;
    } finally {
      setIsRequestingPermission(false);
    }
  }, [isRequestingPermission]);

  const openSettings = useCallback(() => {
    console.log('[useTWAMicrophonePermission] Opening app settings...');
    openTWAAppSettings();
  }, []);

  const getStatusMessage = useCallback(() => {
    if (!permissionStatus) return 'Checking microphone access...';
    return getPermissionStatusMessage(permissionStatus);
  }, [permissionStatus]);

  // Check permission on mount and when app becomes visible
  useEffect(() => {
    checkPermission();
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Re-check permission when app becomes visible (user might have changed settings)
        setTimeout(checkPermission, 500);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkPermission]);

  // Re-check permission after potential settings changes
  useEffect(() => {
    if (permissionStatus?.requiresSettings) {
      const interval = setInterval(() => {
        checkPermission();
      }, 3000); // Check every 3 seconds when settings are required
      
      return () => clearInterval(interval);
    }
  }, [permissionStatus?.requiresSettings, checkPermission]);

  return {
    permissionStatus,
    isCheckingPermission,
    isRequestingPermission,
    hasPermission: permissionStatus?.status === 'granted',
    canRequest: permissionStatus?.canRequest || false,
    requiresSettings: permissionStatus?.requiresSettings || false,
    checkPermission,
    requestPermission,
    openSettings,
    getStatusMessage
  };
}
