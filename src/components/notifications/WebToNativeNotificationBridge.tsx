
import React, { useEffect } from 'react';
import { webToNativeNotificationService } from '@/services/webToNativeNotificationService';

interface WebToNativeNotificationBridgeProps {
  children: React.ReactNode;
}

export const WebToNativeNotificationBridge: React.FC<WebToNativeNotificationBridgeProps> = ({ children }) => {
  useEffect(() => {
    console.log('[WebToNativeNotificationBridge] Initializing bridge');
    
    // Set up message listeners for React Native WebView
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'notificationPermissionResult') {
          console.log('[WebToNativeNotificationBridge] Received permission result:', data.granted);
          // Handle permission result from native side
        }
        
        if (data.type === 'notificationTapped') {
          console.log('[WebToNativeNotificationBridge] Notification tapped:', data);
          // Handle notification tap from native side
          // Navigate to journal page or relevant section
          if (window.location.pathname !== '/app/journal') {
            window.location.href = '/app/journal';
          }
        }
      } catch (error) {
        // Not a JSON message, ignore
      }
    };

    // Listen for messages from React Native
    window.addEventListener('message', handleMessage);
    document.addEventListener('message', handleMessage);

    // Expose notification methods to global scope for WebToNative
    (window as any).webToNativeNotificationService = {
      requestPermission: () => webToNativeNotificationService.requestPermission(),
      showNotification: (options: any) => webToNativeNotificationService.showNotification(options.title, options),
      getPermissionStatus: () => webToNativeNotificationService.getPermissionStatus(),
      isSupported: () => webToNativeNotificationService.isSupported()
    };

    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('message', handleMessage);
      delete (window as any).webToNativeNotificationService;
    };
  }, []);

  return <>{children}</>;
};
