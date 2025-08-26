
import React, { useState } from 'react';
import { Bell, Clock, Bug, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { nativeNotificationService } from '@/services/nativeNotificationService';
import { timezoneNotificationHelper } from '@/services/timezoneNotificationHelper';
import { notificationDebugLogger } from '@/services/notificationDebugLogger';
import { NotificationDebugPanel } from './NotificationDebugPanel';
import { toast } from 'sonner';

// Remove hardcoded time mappings - use exact user input instead

export const JournalReminderSettings: React.FC = () => {
  const [settings, setSettings] = useState({ enabled: false, exactTimes: [] as string[] });
  const [isLoading, setIsLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [timezoneInfo, setTimezoneInfo] = useState<any>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [newReminderTime, setNewReminderTime] = useState('12:00');

  const handleToggleEnabled = async (enabled: boolean) => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      if (enabled) {
        // Need to have at least one time
        if (settings.exactTimes.length === 0) {
          toast.error('Please add at least one reminder time');
          setIsLoading(false);
          return;
        }
        
        console.log('[JournalReminderSettings] User enabling reminders with exact times:', settings.exactTimes);
        const result = await nativeNotificationService.requestPermissions();
        
        if (result.granted) {
          // Use exact times directly - NO CONVERSION OR MAPPING
          const reminderSettings = {
            reminders: settings.exactTimes.map((time, index) => ({
              id: `exact-${time}-${index}`,
              enabled: true,
              time: time, // Use exact HH:MM format (e.g., "12:40")
              label: `Journal Reminder ${time}`
            }))
          };
          
          console.log('[JournalReminderSettings] Scheduling with exact settings:', reminderSettings);
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

  const handleAddReminderTime = async () => {
    if (!newReminderTime || settings.exactTimes.includes(newReminderTime)) {
      toast.error('Time already exists or invalid');
      return;
    }
    
    const newTimes = [...settings.exactTimes, newReminderTime];
    setSettings(prev => ({ ...prev, exactTimes: newTimes }));
    
    // If reminders are currently enabled, update them
    if (settings.enabled) {
      const reminderSettings = {
        reminders: newTimes.map((time, index) => ({
          id: `exact-${time}-${index}`,
          enabled: true,
          time: time, // Use exact time
          label: `Journal Reminder ${time}`
        }))
      };
      console.log('[JournalReminderSettings] Adding new time, updating settings:', reminderSettings);
      await nativeNotificationService.saveAndScheduleSettings(reminderSettings);
      toast.success(`Added reminder for ${newReminderTime}`);
      
      // Update system status
      const status = await nativeNotificationService.getDetailedStatus();
      setSystemStatus(status);
    }
  };

  const handleRemoveReminderTime = async (timeToRemove: string) => {
    const newTimes = settings.exactTimes.filter(t => t !== timeToRemove);
    setSettings(prev => ({ ...prev, exactTimes: newTimes }));
    
    if (settings.enabled && newTimes.length > 0) {
      const reminderSettings = {
        reminders: newTimes.map((time, index) => ({
          id: `exact-${time}-${index}`,
          enabled: true,
          time: time,
          label: `Journal Reminder ${time}`
        }))
      };
      await nativeNotificationService.saveAndScheduleSettings(reminderSettings);
      toast.success(`Removed reminder for ${timeToRemove}`);
    } else if (settings.enabled && newTimes.length === 0) {
      // If no times left, disable reminders
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

        {/* Exact Time Management */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            <TranslatableText text="Reminder Times (Exact HH:MM)" />
          </Label>
          
          {/* Add New Time */}
          <div className="flex gap-2">
            <Input
              type="time"
              value={newReminderTime}
              onChange={(e) => setNewReminderTime(e.target.value)}
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              onClick={handleAddReminderTime}
              disabled={isLoading}
              size="sm"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Current Times */}
          {settings.exactTimes.length > 0 && (
            <div className="space-y-2">
              {settings.exactTimes.map((time, index) => (
                <div 
                  key={`${time}-${index}`}
                  className="flex items-center justify-between p-2 border rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-mono text-sm">{time}</span>
                    <span className="text-xs text-muted-foreground">
                      ({timezoneNotificationHelper.formatTimeForUser(
                        timezoneNotificationHelper.getNextExactReminderTimeInTimezone(
                          parseInt(time.split(':')[0]), 
                          parseInt(time.split(':')[1])
                        ),
                        'PPpp'
                      )})
                    </span>
                  </div>
                  <Button
                    onClick={() => handleRemoveReminderTime(time)}
                    disabled={isLoading}
                    size="sm"
                    variant="ghost"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>


        {settings.enabled && settings.exactTimes.length === 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <TranslatableText text="Please add at least one reminder time to enable notifications." />
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
            {settings.enabled && settings.exactTimes.length > 0 && (
              <div className="text-xs space-y-1">
                <div className="font-medium text-green-800 mb-2">Next Scheduled Times</div>
                {settings.exactTimes.map(time => {
                  const [hour, minute] = time.split(':').map(Number);
                  const exactTime = timezoneNotificationHelper.getNextExactReminderTimeInTimezone(hour, minute);
                  return (
                    <div key={time} className="flex justify-between">
                      <span className="font-mono">{time}:</span>
                      <span className="font-mono text-green-600">
                        {timezoneNotificationHelper.formatTimeForUser(exactTime, 'PPpp')}
                      </span>
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
