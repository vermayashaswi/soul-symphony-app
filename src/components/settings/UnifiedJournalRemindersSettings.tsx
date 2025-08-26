import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { nativeNotificationService, NotificationSettings } from '@/services/nativeNotificationService';

const TIME_OPTIONS = [
  { value: '08:00', label: '8:00 AM - Morning reflection' },
  { value: '14:00', label: '2:00 PM - Afternoon check-in' },
  { value: '19:00', label: '7:00 PM - Evening thoughts' },
  { value: '22:00', label: '10:00 PM - End of day' }
];

export function UnifiedJournalRemindersSettings() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState<string>('19:00');
  const [isLoading, setIsLoading] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<any>(null);
  const [debugExpanded, setDebugExpanded] = useState(false);
  const [scheduledCount, setScheduledCount] = useState(0);

  useEffect(() => {
    loadSettings();
    getDetailedStatus();
  }, []);

  const loadSettings = async () => {
    const settings = await nativeNotificationService.getReminderSettings();
    if (settings && settings.reminders.length > 0) {
      const firstReminder = settings.reminders[0];
      setIsEnabled(firstReminder.enabled);
      setReminderTime(firstReminder.time);
    }
  };

  const getDetailedStatus = async () => {
    try {
      const status = await nativeNotificationService.getDetailedStatus();
      setNotificationStatus(status);
      setScheduledCount(status.scheduledCount);
    } catch (error) {
      console.error('Error getting notification status:', error);
    }
  };

  const handleEnableToggle = async (enabled: boolean) => {
    setIsLoading(true);
    
    try {
      if (enabled) {
        // First request permissions
        console.log('[UnifiedJournalRemindersSettings] Requesting permissions...');
        const permissionResult = await nativeNotificationService.requestPermissions();
        
        if (!permissionResult.granted) {
          toast.error('❌ Permission Required', {
            description: 'Please allow notifications to enable reminders'
          });
          return;
        }
        
        // Create reminder settings
        const settings: NotificationSettings = {
          reminders: [{
            id: 'daily-reminder',
            enabled: true,
            time: reminderTime,
            label: TIME_OPTIONS.find(t => t.value === reminderTime)?.label || 'Daily journal reminder'
          }]
        };
        
        // Save and schedule
        const result = await nativeNotificationService.saveAndScheduleSettings(settings);
        
        if (result.success) {
          setIsEnabled(true);
          setScheduledCount(result.scheduledCount || 0);
          toast.success('✅ Native journal reminders enabled!', {
            description: `Scheduled ${result.scheduledCount} notification${result.scheduledCount !== 1 ? 's' : ''}`
          });
          await getDetailedStatus();
        } else {
          toast.error('❌ Failed to enable reminders', {
            description: result.error || 'Unknown error occurred'
          });
        }
      } else {
        // Disable reminders
        await nativeNotificationService.clearScheduledNotifications();
        
        const settings: NotificationSettings = {
          reminders: [{
            id: 'daily-reminder',
            enabled: false,
            time: reminderTime,
            label: 'Disabled'
          }]
        };
        
        await nativeNotificationService.saveAndScheduleSettings(settings);
        setIsEnabled(false);
        setScheduledCount(0);
        toast.success('Reminders disabled');
        await getDetailedStatus();
      }
    } catch (error) {
      console.error('Error toggling reminders:', error);
      toast.error('An error occurred while setting up reminders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeChange = async (newTime: string) => {
    setReminderTime(newTime);
    
    if (isEnabled) {
      setIsLoading(true);
      try {
        const settings: NotificationSettings = {
          reminders: [{
            id: 'daily-reminder',
            enabled: true,
            time: newTime,
            label: TIME_OPTIONS.find(t => t.value === newTime)?.label || 'Daily journal reminder'
          }]
        };
        
        const result = await nativeNotificationService.saveAndScheduleSettings(settings);
        if (result.success) {
          toast.success(`Reminder time updated to ${TIME_OPTIONS.find(t => t.value === newTime)?.label}`);
          setScheduledCount(result.scheduledCount || 0);
          await getDetailedStatus();
        } else {
          toast.error('Failed to update reminder time');
        }
      } catch (error) {
        console.error('Error updating reminder time:', error);
        toast.error('Failed to update reminder time');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const testReminder = async () => {
    setIsLoading(true);
    try {
      const result = await nativeNotificationService.testNotification();
      if (result.success) {
        toast.success('🧪 Test reminder sent!', {
          description: 'Check your notifications to confirm they\'re working.'
        });
      } else {
        toast.error('❌ Test reminder failed', {
          description: result.error || 'Please check your notification settings.'
        });
      }
    } catch (error) {
      console.error('Error testing reminder:', error);
      toast.error('Error testing reminder');
    } finally {
      setIsLoading(false);
    }
  };

  const clearDebugLogs = async () => {
    await nativeNotificationService.clearScheduledNotifications();
    toast.success('Scheduled notifications cleared');
    getDetailedStatus();
  };

  const getHealthStatusBadge = () => {
    if (!notificationStatus || notificationStatus.permissionState === 'denied') {
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><AlertTriangle className="w-3 h-3 mr-1" />Denied</Badge>;
    }
    
    if (notificationStatus.permissionState === 'granted' && scheduledCount > 0) {
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
    }
    
    if (notificationStatus.permissionState === 'default') {
      return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><AlertTriangle className="w-3 h-3 mr-1" />Pending</Badge>;
    }
    
    return <Badge variant="outline">Unknown</Badge>;
  };

  const getNextReminderTime = () => {
    if (!isEnabled) return null;
    
    const [hours, minutes] = reminderTime.split(':').map(Number);
    const now = new Date();
    const nextTime = new Date();
    nextTime.setHours(hours, minutes, 0, 0);
    
    if (nextTime <= now) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
    
    return nextTime.toLocaleString();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Native Journal Reminders
          <div className="flex gap-2">
            {getHealthStatusBadge()}
            {notificationStatus && (
              <Badge variant="outline" className="text-xs">
                {notificationStatus.platform} • {scheduledCount} scheduled
              </Badge>
            )}
          </div>
        </CardTitle>
        <CardDescription>
          Direct native notifications using Capacitor LocalNotifications with proper Android scheduling.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* System Status Overview */}
        {notificationStatus && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-sm font-medium">Platform</p>
              <Badge variant="outline">
                {notificationStatus.isNative ? '📱 Native' : '🌐 Web'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Permissions</p>
              <Badge variant="outline">{notificationStatus.permissionState}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Scheduled</p>
              <Badge variant="outline">{scheduledCount} notifications</Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Supported</p>
              <Badge variant="outline">{notificationStatus.isSupported ? '✅' : '❌'}</Badge>
            </div>
          </div>
        )}

        {/* Main Settings */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium">Enable Daily Reminders</h3>
            <p className="text-sm text-muted-foreground">
              Get native Android notifications with repeating daily schedules
            </p>
            {getNextReminderTime() && (
              <p className="text-xs text-muted-foreground mt-1">
                Next reminder: {getNextReminderTime()}
              </p>
            )}
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleEnableToggle}
            disabled={isLoading}
          />
        </div>

        {/* Time Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Reminder Time</label>
          <Select value={reminderTime} onValueChange={handleTimeChange} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={testReminder}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Testing...' : '🧪 Test Reminder'}
          </Button>
          <Button 
            variant="outline" 
            onClick={getDetailedStatus}
            disabled={isLoading}
            size="sm"
          >
            🔄 Refresh Status
          </Button>
        </div>

        {/* Notification Status */}
        {notificationStatus && (
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Native Notification Status
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Platform:</span>
                <div className="font-mono">{notificationStatus.platform}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Permission:</span>
                <div className="font-mono">{notificationStatus.permissionState}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Scheduled:</span>
                <div className="font-mono">{scheduledCount}</div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Dashboard */}
        <Collapsible open={debugExpanded} onOpenChange={setDebugExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center">
                <Activity className="w-4 h-4 mr-2" />
                Debug Dashboard
              </span>
              {debugExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            {/* Native Debug Information */}
            {notificationStatus && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Native Status Details</h5>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <div>Platform: <code>{notificationStatus.platform}</code></div>
                  <div>Is Native: <code>{notificationStatus.isNative ? 'Yes' : 'No'}</code></div>
                  <div>Permission State: <code>{notificationStatus.permissionState}</code></div>
                  <div>Scheduled Count: <code>{scheduledCount}</code></div>
                  <div>Last Check: <code>{notificationStatus.debugInfo?.lastCheck}</code></div>
                </div>
              </div>
            )}

            {/* Scheduled Notifications */}
            {notificationStatus?.pendingNotifications && (
              <div className="p-3 bg-gray-50 dark:bg-gray-950/30 border border-gray-200 dark:border-gray-800 rounded-lg">
                <h5 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Pending Notifications ({notificationStatus.pendingNotifications.length})
                </h5>
                <div className="max-h-40 overflow-y-auto text-xs font-mono space-y-1">
                  {notificationStatus.pendingNotifications.slice(0, 5).map((notification: any, index: number) => (
                    <div key={index} className="p-1 rounded text-gray-700 dark:text-gray-300">
                      ID: {notification.id} - {notification.title} at {new Date(notification.schedule?.at).toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clear Scheduled Notifications */}
            <div className="p-3 bg-gray-50 dark:bg-gray-950/30 border border-gray-200 dark:border-gray-800 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h5 className="font-medium text-gray-800 dark:text-gray-200">Maintenance</h5>
                <Button variant="outline" size="sm" onClick={clearDebugLogs}>
                  Clear All Scheduled
                </Button>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Use this to clear all scheduled notifications if there are issues.
              </p>
            </div>

            {/* Export Debug Data */}
            <Button 
              variant="outline" 
              onClick={() => {
                const data = JSON.stringify(notificationStatus, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `notification-debug-${new Date().toISOString()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="w-full"
            >
              📥 Export Debug Data
            </Button>
          </CollapsibleContent>
        </Collapsible>

        {/* Platform-specific Guidance */}
        {notificationStatus?.isNative && (
          <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
              📱 Native Platform Detected
            </h4>
            <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
              <p>Using Capacitor LocalNotifications for native scheduling.</p>
              <p>Notifications will repeat daily at the specified time.</p>
            </div>
          </div>
        )}

        {notificationStatus?.platform === 'android' && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              🤖 Android Optimization Tips
            </h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <ul className="list-disc list-inside space-y-1">
                <li>Add app to battery optimization whitelist</li>
                <li>Enable "Allow background activity"</li>
                <li>Set notification importance to "High"</li>
                <li>Allow precise alarm permissions (Android 12+)</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}