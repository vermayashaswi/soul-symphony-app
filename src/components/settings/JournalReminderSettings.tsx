
import React, { useState } from 'react';
import { Bell, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { journalReminderService, JournalReminderTime } from '@/services/journalReminderService';
import { unifiedNotificationService } from '@/services/unifiedNotificationService';
import { toast } from 'sonner';

const TIME_OPTIONS: { value: JournalReminderTime; label: string; time: string }[] = [
  { value: 'morning', label: 'Morning', time: '8:00 AM' },
  { value: 'afternoon', label: 'Afternoon', time: '2:00 PM' },
  { value: 'evening', label: 'Evening', time: '7:00 PM' },
  { value: 'night', label: 'Night', time: '10:00 PM' }
];

export const JournalReminderSettings: React.FC = () => {
  const [settings, setSettings] = useState(journalReminderService.getSettings());
  const [isLoading, setIsLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);

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
        const success = await journalReminderService.requestPermissionsAndSetup(settings.times);
        
        if (success) {
          setSettings(prev => ({ ...prev, enabled: true }));
          toast.success('Journal reminders enabled!');
          
          // Update system status
          const status = await journalReminderService.getNotificationStatus();
          setSystemStatus(status);
        } else {
          toast.error('Failed to enable reminders. Please check your notification settings and try again.');
        }
      } else {
        console.log('[JournalReminderSettings] User disabling reminders');
        await journalReminderService.disableReminders();
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
      journalReminderService.requestPermissionsAndSetup(newTimes);
    } else if (settings.enabled && newTimes.length === 0) {
      // If no times selected, disable reminders
      handleToggleEnabled(false);
    }
  };

  const handleTestNotification = async () => {
    setIsLoading(true);
    try {
      const result = await unifiedNotificationService.testNotification();
      const success = result.success;
      if (success) {
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
      const status = await journalReminderService.getNotificationStatus();
      setSystemStatus(status);
      toast.success('Status refreshed');
    } catch (error) {
      console.error('Error refreshing status:', error);
      toast.error('Failed to refresh status');
    } finally {
      setIsLoading(false);
    }
  };


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

        {/* Enhanced Android Status Display */}
        {systemStatus?.androidEnhancedStatus && (
          <div className="space-y-2 p-3 bg-gray-50 border rounded-lg">
            <h4 className="text-sm font-medium">System Status</h4>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Notification Permission:</span>
                <span className={systemStatus.androidEnhancedStatus.hasNotificationPermission ? 'text-green-600' : 'text-red-600'}>
                  {systemStatus.androidEnhancedStatus.hasNotificationPermission ? 'Granted' : 'Denied'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Channels Created:</span>
                <span className={systemStatus.androidEnhancedStatus.channelsCreated ? 'text-green-600' : 'text-red-600'}>
                  {systemStatus.androidEnhancedStatus.channelsCreated ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Scheduled Count:</span>
                <span>{systemStatus.androidEnhancedStatus.scheduledCount}</span>
              </div>
              {systemStatus.androidEnhancedStatus.lastError && (
                <div className="text-red-600 text-xs">
                  Error: {systemStatus.androidEnhancedStatus.lastError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {settings.enabled && (
          <div className="flex gap-2">
            <button
              onClick={handleTestNotification}
              disabled={isLoading}
              className="px-3 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Test Notification
            </button>
            <button
              onClick={handleRefreshStatus}
              disabled={isLoading}
              className="px-3 py-2 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              Refresh Status
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
