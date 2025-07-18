
export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export const useNotificationPermissionSimple = () => {
  console.log('Notification permissions disabled');

  const requestPermission = async (): Promise<boolean> => {
    console.log('Notification service disabled - permission request ignored');
    return false;
  };

  return {
    permission: 'unsupported' as NotificationPermissionState,
    isSupported: false,
    isGranted: false,
    isDenied: false,
    isDefault: true,
    initializationComplete: true,
    requestPermission
  };
};
