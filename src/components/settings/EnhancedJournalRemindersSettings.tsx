import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { enhancedJournalReminderService, JournalReminderTime } from '@/services/enhancedJournalReminderService';
import { enhancedPlatformService } from '@/services/enhancedPlatformService';

const TIME_OPTIONS = [
  { value: 'morning', label: '8:00 AM - Morning reflection' },
  { value: 'afternoon', label: '2:00 PM - Afternoon check-in' },
  { value: 'evening', label: '7:00 PM - Evening thoughts' },
  { value: 'night', label: '10:00 PM - End of day' }
];

export function EnhancedJournalRemindersSettings() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState<JournalReminderTime>('evening');
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [isNative, setIsNative] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<any>(null);

  useEffect(() => {
    loadSettings();
    checkEnvironment();
    checkPermissionStatus();
    getDetailedStatus();
  }, []);

  const loadSettings = () => {
    const settings = enhancedJournalReminderService.getSettings();
    setIsEnabled(settings.enabled);
    if (settings.times.length > 0) {
      setReminderTime(settings.times[0]); // Use first time for UI simplicity
    }
  };

  const checkEnvironment = async () => {
    try {
      const platformInfo = await enhancedPlatformService.detectPlatform();
      setIsNative(platformInfo.isNative);
    } catch (error) {
      console.error('Error detecting platform:', error);
    }
  };

  const checkPermissionStatus = async () => {
    try {
      if (isNative) {
        // Native permission check would go here
        setPermissionStatus('unknown');
      } else {
        setPermissionStatus(Notification.permission);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setPermissionStatus('error');
    }
  };

  const getDetailedStatus = async () => {
    try {
      const status = await enhancedJournalReminderService.getNotificationStatus();
      setNotificationStatus(status);
      setPermissionStatus(status.permissionState);
    } catch (error) {
      console.error('Error getting notification status:', error);
    }
  };

  const handleEnableToggle = async (enabled: boolean) => {
    setIsLoading(true);
    
    try {
      if (enabled) {
        const success = await enhancedJournalReminderService.requestPermissionsAndSetup([reminderTime]);
        
        if (success) {
          setIsEnabled(true);
          toast.success('✅ Enhanced journal reminders enabled successfully!', {
            description: `You'll receive ${reminderTime} reminders with improved reliability.`
          });
          await getDetailedStatus();
        } else {
          toast.error('❌ Failed to enable reminders', {
            description: 'Please check your notification permissions and try again.'
          });
        }
      } else {
        await enhancedJournalReminderService.disableReminders();
        setIsEnabled(false);
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
    setReminderTime(newTime as JournalReminderTime);
    
    if (isEnabled) {
      setIsLoading(true);
      try {
        await scheduleReminder(newTime as JournalReminderTime);
        toast.success(`Reminder time updated to ${TIME_OPTIONS.find(t => t.value === newTime)?.label}`);
        await getDetailedStatus();
      } catch (error) {
        console.error('Error updating reminder time:', error);
        toast.error('Failed to update reminder time');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const scheduleReminder = async (time: JournalReminderTime) => {
    await enhancedJournalReminderService.requestPermissionsAndSetup([time]);
  };

  const testReminder = async () => {
    setIsLoading(true);
    try {
      const success = await enhancedJournalReminderService.testReminder();
      if (success) {
        toast.success('🧪 Test reminder sent!', {
          description: 'Check your notifications to confirm they\'re working.'
        });
      } else {
        toast.error('❌ Test reminder failed', {
          description: 'Please check your notification settings.'
        });
      }
    } catch (error) {
      console.error('Error testing reminder:', error);
      toast.error('Error testing reminder');
    } finally {
      setIsLoading(false);
    }
  };

  const getPermissionBadge = () => {
    const badgeMap = {
      granted: <Badge className="bg-green-500/10 text-green-500 border-green-500/20">✅ Granted</Badge>,
      denied: <Badge className="bg-red-500/10 text-red-500 border-red-500/20">❌ Denied</Badge>,
      default: <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">⚠️ Default</Badge>,
      unknown: <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">❓ Unknown</Badge>
    };
    
    return badgeMap[permissionStatus as keyof typeof badgeMap] || badgeMap.unknown;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Enhanced Journal Reminders
          {notificationStatus && (
            <Badge variant="outline" className="text-xs">
              {notificationStatus.strategy} • {notificationStatus.activeReminders} active
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Improved daily reminders with enhanced reliability for Android devices.
          {isNative && " Running in native mode with advanced features."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Environment and Permission Status */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
          <div>
            <p className="text-sm font-medium">Environment</p>
            <Badge variant="outline">{isNative ? '📱 Native App' : '🌐 Web App'}</Badge>
          </div>
          <div>
            <p className="text-sm font-medium">Permissions</p>
            {getPermissionBadge()}
          </div>
        </div>

        {/* Enhanced Status Display */}
        {notificationStatus && (
          <div className="p-4 bg-muted/30 rounded-lg">
            <p className="text-sm font-medium mb-2">Notification System Status</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Strategy: <span className="font-mono">{notificationStatus.strategy}</span></div>
              <div>Active: <span className="font-mono">{notificationStatus.activeReminders}</span></div>
              {notificationStatus.pendingNative && (
                <div>Pending: <span className="font-mono">{notificationStatus.pendingNative}</span></div>
              )}
              <div>Channels: <span className="font-mono">{notificationStatus.channelsCreated ? '✅' : '❌'}</span></div>
            </div>
          </div>
        )}

        {/* Main Settings */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium">Enable Daily Reminders</h3>
            <p className="text-sm text-muted-foreground">
              Get enhanced notifications to journal regularly
            </p>
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

        {/* Test Button */}
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

        {/* Instructions for denied permissions */}
        {permissionStatus === 'denied' && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
              Notification Permissions Required
            </h4>
            <div className="text-sm text-red-700 dark:text-red-300 space-y-2">
              <p>To enable reminders, please:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to your browser/app settings</li>
                <li>Find Soulo in the permissions section</li>
                <li>Enable notifications</li>
                {isNative && (
                  <>
                    <li>Disable battery optimization for Soulo</li>
                    <li>Allow background activity</li>
                  </>
                )}
                <li>Refresh this page and try again</li>
              </ol>
            </div>
          </div>
        )}

        {/* Android-specific guidance */}
        {isNative && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              📱 Android Optimization Tips
            </h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p>For the most reliable notifications:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Add Soulo to your battery optimization whitelist</li>
                <li>Enable "Allow background activity"</li>
                <li>Set notification importance to "High"</li>
                <li>Keep your device connected to WiFi or mobile data</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}