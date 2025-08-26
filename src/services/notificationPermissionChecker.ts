// Simplified permission checker for backward compatibility
export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export const notificationPermissionChecker = {
  checkPermissionStatus: async (): Promise<NotificationPermissionState> => {
    if ('Notification' in window) {
      return Notification.permission as NotificationPermissionState;
    }
    return 'unsupported';
  },
  
  getDebugStatus: async () => ({
    platform: 'web',
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
    timestamp: new Date().toISOString()
  })
};