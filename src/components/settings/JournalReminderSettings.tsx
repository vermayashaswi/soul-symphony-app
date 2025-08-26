
import React, { useState } from 'react';
import { Bell, Clock, Bug } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { nativeNotificationService } from '@/services/nativeNotificationService';
import { timezoneNotificationHelper, JournalReminderTime } from '@/services/timezoneNotificationHelper';
import { notificationDebugLogger } from '@/services/notificationDebugLogger';
import { NotificationDebugPanel } from './NotificationDebugPanel';
// Helper function to convert time names to HH:MM format
const getTimeString = (time: JournalReminderTime): string => {
  switch (time) {
    case 'morning': return '08:00';
    case 'afternoon': return '14:00';
    case 'evening': return '19:00';
    case 'night': return '22:00';
    default: return '19:00';
  }
};
import { toast } from 'sonner';

const TIME_OPTIONS: { value: JournalReminderTime; label: string; time: string }[] = [
  { value: 'morning', label: 'Morning', time: '8:00 AM' },
  { value: 'afternoon', label: 'Afternoon', time: '2:00 PM' },
  { value: 'evening', label: 'Evening', time: '7:00 PM' },
  { value: 'night', label: 'Night', time: '10:00 PM' }
];

export const JournalReminderSettings: React.FC = () => {
  const [settings, setSettings] = useState({ enabled: false, times: [] as JournalReminderTime[] });
  const [isLoading, setIsLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [timezoneInfo, setTimezoneInfo] = useState<any>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const handleToggleEnabled = async (enabled: boolean) => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      if (enabled) {
        // Need to select at least one time
        if (settings.times.length === 0) {
          toast.error('Please select at least one reminder time');
          setIsLoading(false);
          return;
        }
        
        console.log('[JournalReminderSettings] User enabling reminders');
        const result = await nativeNotificationService.requestPermissions();
        
        if (result.granted) {
          // Convert times to proper format for native service
          const reminderSettings = {
            reminders: settings.times.map((time, index) => ({
              id: `${time}-${index}`,
              enabled: true,
              time: getTimeString(time),
              label: `${time.charAt(0).toUpperCase() + time.slice(1)} Reminder`
            }))
          };
          
          await nativeNotificationService.saveAndScheduleSettings(reminderSettings);
          setSettings(prev => ({ ...prev, enabled: true }));
          toast.success('Journal reminders enabled!');
          
          // Update system status
          const status = await nativeNotificationService.getDetailedStatus();
          setSystemStatus(status);
        } else {
          toast.error('Failed to enable reminders. Please check your notification settings and try again.');
        }
      } else {
        console.log('[JournalReminderSettings] User disabling reminders');
        await nativeNotificationService.clearScheduledNotifications();
        setSettings(prev => ({ ...prev, enabled: false }));
        toast.success('Journal reminders disabled');
      }
    } catch (error) {
      console.error('[JournalReminderSettings] Error toggling reminders:', error);
      toast.error('Failed to update reminder settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeToggle = (time: JournalReminderTime, checked: boolean) => {
    const newTimes = checked 
      ? [...settings.times, time]
      : settings.times.filter(t => t !== time);
    
    setSettings(prev => ({ ...prev, times: newTimes }));
    
    // If reminders are currently enabled, update them
    if (settings.enabled && newTimes.length > 0) {
      // Update scheduled reminders with new times
      const reminderSettings = {
        reminders: newTimes.map((time, index) => ({
          id: `${time}-${index}`,
          enabled: true,
          time: getTimeString(time),
          label: `${time.charAt(0).toUpperCase() + time.slice(1)} Reminder`
        }))
      };
      nativeNotificationService.saveAndScheduleSettings(reminderSettings);
    } else if (settings.enabled && newTimes.length === 0) {
      // If no times selected, disable reminders
      handleToggleEnabled(false);
    }
  };

  const handleTestNotification = async () => {
    setIsLoading(true);
    try {
      const result = await nativeNotificationService.testNotification();
      if (result.success) {
        toast.success('Test notification sent! Check your notification panel.');
      } else {
        toast.error('Failed to send test notification.');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Error sending test notification.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    setIsLoading(true);
    try {
      // Initialize timezone helper and get status
      await timezoneNotificationHelper.initializeUserTimezone();
      const status = await nativeNotificationService.getDetailedStatus();
      const tzInfo = timezoneNotificationHelper.getTimezoneDebugInfo();
      
      setSystemStatus(status);
      setTimezoneInfo(tzInfo);
      
      // Log the refresh action
      notificationDebugLogger.logUserAction('STATUS_REFRESH', { status, tzInfo });
      
      toast.success('Status refreshed');
    } catch (error) {
      console.error('Error refreshing status:', error);
      toast.error('Failed to refresh status');
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial status on mount
  React.useEffect(() => {
    handleRefreshStatus();
  }, []);


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <TranslatableText text="Journal Reminders" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="reminders-enabled" className="text-sm font-medium">
              <TranslatableText text="Enable Journal Reminders" />
            </Label>
            <p className="text-xs text-muted-foreground">
              <TranslatableText text="Get notified to write in your journal" />
            </p>
          </div>
          <Switch
            id="reminders-enabled"
            checked={settings.enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={isLoading}
          />
        </div>

        {/* Time Selection */}
        {(settings.enabled || settings.times.length > 0) && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              <TranslatableText text="Reminder Times" />
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_OPTIONS.map(option => (
                <div 
                  key={option.value}
                  className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-muted/50"
                >
                  <Switch
                    id={`time-${option.value}`}
                    checked={settings.times.includes(option.value)}
                    onCheckedChange={(checked) => handleTimeToggle(option.value, checked)}
                    disabled={isLoading}
                  />
                  <div className="flex-1">
                    <Label 
                      htmlFor={`time-${option.value}`}
                      className="text-sm cursor-pointer"
                    >
                      <TranslatableText text={option.label} />
                    </Label>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {option.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {settings.enabled && settings.times.length === 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <TranslatableText text="Please select at least one reminder time to enable notifications." />
            </p>
          </div>
        )}

        {/* Enhanced System Status Display */}
        {systemStatus && (
          <div className="space-y-3 p-3 bg-gray-50 border rounded-lg">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              System Status
            </h4>
            
            {/* Timezone Information */}
            <div className="text-xs space-y-1">
              <div className="font-medium text-blue-800 mb-2">Timezone Information</div>
              <div className="flex justify-between">
                <span>User Timezone:</span>
                <span className="font-mono">{systemStatus.userTimezone}</span>
              </div>
              <div className="flex justify-between">
                <span>Device Timezone:</span>
                <span className="font-mono">{systemStatus.deviceTimezone}</span>
              </div>
              {systemStatus.timezoneMismatch && (
                <div className="text-orange-600 text-xs bg-orange-50 p-2 rounded">
                  ⚠️ Timezone mismatch detected. Notifications will use your profile timezone.
                </div>
              )}
            </div>

            {/* Next Notification Times */}
            {settings.enabled && settings.times.length > 0 && timezoneInfo && (
              <div className="text-xs space-y-1">
                <div className="font-medium text-green-800 mb-2">Next Scheduled Times</div>
                {settings.times.map(time => {
                  const timeAware = timezoneNotificationHelper.getTimezoneAwareReminderTime(time);
                  return (
                    <div key={time} className="flex justify-between">
                      <span>{time.charAt(0).toUpperCase() + time.slice(1)}:</span>
                      <span className="font-mono">{timeAware.nextOccurrence.toString()}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Android Enhanced Status */}
            {systemStatus?.androidEnhancedStatus && (
              <div className="text-xs space-y-1">
                <div className="font-medium text-gray-800 mb-2">Android Status</div>
                <div className="flex justify-between">
                  <span>Notification Permission:</span>
                  <span className={systemStatus.androidEnhancedStatus.hasNotificationPermission ? 'text-green-600' : 'text-red-600'}>
                    {systemStatus.androidEnhancedStatus.hasNotificationPermission ? 'Granted' : 'Denied'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Scheduled Count:</span>
                  <span>{systemStatus.androidEnhancedStatus.scheduledCount}</span>
                </div>
                {systemStatus.androidEnhancedStatus.lastError && (
                  <div className="text-red-600 text-xs bg-red-50 p-2 rounded">
                    Error: {systemStatus.androidEnhancedStatus.lastError}
                  </div>
                )}
              </div>
            )}

            {/* General Status */}
            <div className="text-xs space-y-1">
              <div className="font-medium text-gray-800 mb-2">General</div>
              <div className="flex justify-between">
                <span>Platform:</span>
                <span>{systemStatus.platform}</span>
              </div>
              <div className="flex justify-between">
                <span>Native Platform:</span>
                <span className={systemStatus.isNative ? 'text-green-600' : 'text-blue-600'}>
                  {systemStatus.isNative ? 'Yes' : 'Web'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Permission State:</span>
                <span className={systemStatus.permissionState === 'granted' ? 'text-green-600' : 'text-red-600'}>
                  {systemStatus.permissionState}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Debug Events (1h):</span>
                <span>{systemStatus.debugInfo?.debugEvents || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleTestNotification}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            Test Notification (30s)
          </Button>
          <Button
            onClick={handleRefreshStatus}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            Refresh Status
          </Button>
          <Button
            onClick={() => setShowDebugPanel(true)}
            variant="outline"
            size="sm"
          >
            <Bug className="h-4 w-4 mr-2" />
            Debug Panel
          </Button>
          <Button
            onClick={() => {
              const report = notificationDebugLogger.generateDebugReport();
              console.log('=== NOTIFICATION DEBUG REPORT ===');
              console.log(report);
              toast.success('Debug report generated (check console)');
            }}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            Console Report
          </Button>
        </div>

        {/* Troubleshooting Guidance */}
        {systemStatus?.permissionState === 'denied' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 mb-2">
              <strong>Notifications Disabled</strong>
            </p>
            <p className="text-xs text-red-700">
              Please enable notifications in your device settings and refresh this page.
            </p>
          </div>
        )}

        {systemStatus?.timezoneMismatch && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800 mb-2">
              <strong>Timezone Mismatch Detected</strong>
            </p>
            <p className="text-xs text-orange-700">
              Your device timezone differs from your profile timezone. Notifications will fire based on your profile timezone ({systemStatus.userTimezone}).
            </p>
          </div>
        )}

        {systemStatus?.platform === 'android' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Android Optimization Tips</strong>
            </p>
            <p className="text-xs text-blue-700">
              For reliable notifications: Disable battery optimization for this app and ensure "Do Not Disturb" allows notifications.
            </p>
          </div>
        )}
      </CardContent>
      
      <NotificationDebugPanel
        isOpen={showDebugPanel}
        onClose={() => setShowDebugPanel(false)}
      />
    </Card>
  );
};
