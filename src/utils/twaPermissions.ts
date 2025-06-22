
import { detectTWAEnvironment } from './twaDetection';

export interface PermissionState {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
  unavailable: boolean;
}

export interface TWAPermissionResult {
  status: 'granted' | 'denied' | 'prompt' | 'unavailable';
  canRequest: boolean;
  requiresSettings: boolean;
  message?: string;
}

/**
 * Check microphone permission status in TWA environment
 */
export async function checkTWAMicrophonePermission(): Promise<TWAPermissionResult> {
  const twaEnv = detectTWAEnvironment();
  
  try {
    // First try the Permissions API if available
    if ('permissions' in navigator) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        console.log('[TWA Permissions] Permission API result:', permissionStatus.state);
        
        switch (permissionStatus.state) {
          case 'granted':
            return {
              status: 'granted',
              canRequest: false,
              requiresSettings: false
            };
          case 'denied':
            return {
              status: 'denied',
              canRequest: false,
              requiresSettings: true,
              message: 'Microphone access was denied. Please enable it in your device settings.'
            };
          case 'prompt':
            return {
              status: 'prompt',
              canRequest: true,
              requiresSettings: false
            };
        }
      } catch (permError) {
        console.warn('[TWA Permissions] Permission API failed:', permError);
      }
    }

    // Fallback: Try to access the microphone directly
    console.log('[TWA Permissions] Attempting direct microphone access test...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // If we get here, permission is granted
      stream.getTracks().forEach(track => track.stop());
      
      return {
        status: 'granted',
        canRequest: false,
        requiresSettings: false
      };
      
    } catch (mediaError: any) {
      console.log('[TWA Permissions] Media access error:', mediaError);
      
      if (mediaError.name === 'NotAllowedError') {
        return {
          status: 'denied',
          canRequest: twaEnv.isTWA ? false : true,
          requiresSettings: twaEnv.isTWA,
          message: twaEnv.isTWA 
            ? 'Microphone access is blocked. Please enable it in your app settings or device settings.'
            : 'Microphone access was denied. Please allow access and try again.'
        };
      } else if (mediaError.name === 'NotFoundError') {
        return {
          status: 'unavailable',
          canRequest: false,
          requiresSettings: false,
          message: 'No microphone found on this device.'
        };
      } else {
        return {
          status: 'prompt',
          canRequest: true,
          requiresSettings: false
        };
      }
    }
    
  } catch (error) {
    console.error('[TWA Permissions] Unexpected error:', error);
    return {
      status: 'unavailable',
      canRequest: false,
      requiresSettings: false,
      message: 'Unable to check microphone permissions.'
    };
  }
}

/**
 * Request microphone permission with TWA-specific handling
 */
export async function requestTWAMicrophonePermission(): Promise<TWAPermissionResult> {
  const twaEnv = detectTWAEnvironment();
  
  try {
    console.log('[TWA Permissions] Requesting microphone permission...');
    
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 44100
      }
    });
    
    // Permission granted - clean up the stream
    stream.getTracks().forEach(track => track.stop());
    
    return {
      status: 'granted',
      canRequest: false,
      requiresSettings: false,
      message: 'Microphone access granted successfully!'
    };
    
  } catch (error: any) {
    console.error('[TWA Permissions] Permission request failed:', error);
    
    if (error.name === 'NotAllowedError') {
      return {
        status: 'denied',
        canRequest: false,
        requiresSettings: true,
        message: twaEnv.isTWA 
          ? 'Microphone access is blocked. Please:\n1. Open your device Settings\n2. Find this app in the Apps list\n3. Enable Microphone permission\n4. Return to the app and try again'
          : 'Microphone access was denied. Please allow access when prompted.'
      };
    } else if (error.name === 'NotFoundError') {
      return {
        status: 'unavailable',
        canRequest: false,
        requiresSettings: false,
        message: 'No microphone found on this device.'
      };
    } else {
      return {
        status: 'unavailable',
        canRequest: true,
        requiresSettings: false,
        message: 'Failed to request microphone permission. Please try again.'
      };
    }
  }
}

/**
 * Open device settings for the app (TWA specific)
 */
export function openTWAAppSettings(): void {
  const twaEnv = detectTWAEnvironment();
  
  if (twaEnv.isTWA && 'androidSettings' in window) {
    try {
      // Try to open app-specific settings if available
      (window as any).androidSettings.openAppSettings();
    } catch (error) {
      console.warn('[TWA Permissions] Could not open app settings:', error);
      fallbackToManualInstructions();
    }
  } else {
    fallbackToManualInstructions();
  }
}

function fallbackToManualInstructions(): void {
  const message = `To enable microphone access:

Android:
1. Open Settings
2. Go to Apps & notifications
3. Find "Soulo" app
4. Tap on Permissions
5. Enable Microphone
6. Return to the app

iOS (if using Safari):
1. Open Settings
2. Go to Safari
3. Tap on Microphone
4. Enable access for soulo.online`;

  alert(message);
}

/**
 * Check if we're in a secure context (required for microphone access)
 */
export function isSecureContext(): boolean {
  return window.isSecureContext || window.location.protocol === 'https:';
}

/**
 * Get user-friendly permission status message
 */
export function getPermissionStatusMessage(result: TWAPermissionResult): string {
  switch (result.status) {
    case 'granted':
      return 'Microphone access is enabled';
    case 'denied':
      return result.message || 'Microphone access is blocked';
    case 'prompt':
      return 'Microphone access needs to be granted';
    case 'unavailable':
      return result.message || 'Microphone is not available';
    default:
      return 'Unknown permission status';
  }
}
