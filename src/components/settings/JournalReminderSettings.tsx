
import React, { useState, useEffect } from 'react';
import { Bell, Clock, Bug, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { JournalReminderTime } from '@/services/journalReminderService';
import { unifiedNotificationService } from '@/services/unifiedNotificationService';
import { notificationDebugLogger } from '@/services/notificationDebugLogger';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';

const TIME_OPTIONS: { value: JournalReminderTime; label: string; time: string }[] = [
  { value: 'morning', label: 'Morning', time: '8:00 AM' },
  { value: 'afternoon', label: 'Afternoon', time: '2:00 PM' },
  { value: 'evening', label: 'Evening', time: '7:00 PM' },
  { value: 'night', label: 'Night', time: '10:00 PM' }
];

export const JournalReminderSettings: React.FC = () => {
  const { timezone } = useUserProfile();
  const [settings, setSettings] = useState({ enabled: false, times: [] as JournalReminderTime[] });
  const [isLoading, setIsLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const enabled = localStorage.getItem('journal_reminder_enabled') === 'true';
    const timesStr = localStorage.getItem('journal_reminder_times');
    let times: JournalReminderTime[] = [];
    
    if (timesStr) {
      try {
        times = JSON.parse(timesStr);
      } catch (error) {
        console.error('Error parsing saved times:', error);
      }
    }
    
    setSettings({ enabled, times });
  };

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
        
        // Log user action with comprehensive debugging
        notificationDebugLogger.logUserSaveSettings(settings.times, true, timezone);
        
        console.log('[JournalReminderSettings] User enabling reminders with timezone:', timezone);
        const result = await unifiedNotificationService.scheduleJournalReminders(settings.times, timezone || undefined);
        
        if (result.success) {
          setSettings(prev => ({ ...prev, enabled: true }));
          localStorage.setItem('journal_reminder_enabled', 'true');
          localStorage.setItem('journal_reminder_times', JSON.stringify(settings.times));
          
          toast.success('Journal reminders enabled!');
          
          // Update system status
          const status = await unifiedNotificationService.getStatus();
          setSystemStatus(status);
        } else {
          toast.error(`Failed to enable reminders: ${result.errors.join(', ')}`);
        }
      } else {
        console.log('[JournalReminderSettings] User disabling reminders');
        notificationDebugLogger.logUserSaveSettings([], false, timezone);
        
        await unifiedNotificationService.disableNotifications();
        setSettings(prev => ({ ...prev, enabled: false }));
        localStorage.setItem('journal_reminder_enabled', 'false');
        
        toast.success('Journal reminders disabled');
      }
    } catch (error) {
      console.error('[JournalReminderSettings] Error toggling reminders:', error);
      notificationDebugLogger.logEvent('error', 'JournalReminderSettings', 'toggle_failed', {
        error: error.message,
        enabled,
        timezone
      });
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
    localStorage.setItem('journal_reminder_times', JSON.stringify(newTimes));
    
    // Log the time selection change
    notificationDebugLogger.logEvent('user_action', 'JournalReminderSettings', 'time_selection_changed', {
      time,
      checked,
      newTimes,
      timezone
    });
    
    // If reminders are currently enabled, update them
    if (settings.enabled && newTimes.length > 0) {
      unifiedNotificationService.scheduleJournalReminders(newTimes, timezone || undefined);
    } else if (settings.enabled && newTimes.length === 0) {
      // If no times selected, disable reminders
      handleToggleEnabled(false);
    }
  };

  const handleTestNotification = async () => {
    setIsLoading(true);
    try {
      notificationDebugLogger.logEvent('user_action', 'JournalReminderSettings', 'test_notification_clicked', {
        timezone
      });
      
      const success = await unifiedNotificationService.testNotification();
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
      const status = await unifiedNotificationService.getStatus();
      setSystemStatus(status);
      
      const debug = notificationDebugLogger.getDebugData();
      setDebugData(debug);
      
      toast.success('Status refreshed');
    } catch (error) {
      console.error('Error refreshing status:', error);
      toast.error('Failed to refresh status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportDebugData = () => {
    const data = notificationDebugLogger.exportDebugData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notification-debug-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Debug data exported');
  };

  const handleClearDebugData = () => {
    notificationDebugLogger.clearDebugData();
    setDebugData(null);
    toast.success('Debug data cleared');
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

        {/* System Status Display */}
        {systemStatus && (
          <div className="space-y-2 p-3 bg-gray-50 border rounded-lg">
            <h4 className="text-sm font-medium">System Status</h4>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Environment:</span>
                <span className="font-mono text-blue-600">
                  {systemStatus.environment?.preferredStrategy} ({systemStatus.environment?.platform})
                </span>
              </div>
              <div className="flex justify-between">
                <span>Native Support:</span>
                <span className={systemStatus.environment?.supportsNativeNotifications ? 'text-green-600' : 'text-red-600'}>
                  {systemStatus.environment?.supportsNativeNotifications ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Web Support:</span>
                <span className={systemStatus.environment?.supportsWebNotifications ? 'text-green-600' : 'text-red-600'}>
                  {systemStatus.environment?.supportsWebNotifications ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Is WebView:</span>
                <span className={systemStatus.environment?.isWebView ? 'text-orange-600' : 'text-green-600'}>
                  {systemStatus.environment?.isWebView ? 'Yes (WebView)' : 'No (Native/Web)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Scheduled Count:</span>
                <span>{systemStatus.scheduledNotifications?.length || 0}</span>
              </div>
              {systemStatus.nativeStatus?.pendingCount !== undefined && (
                <div className="flex justify-between">
                  <span>Native Pending:</span>
                  <span>{systemStatus.nativeStatus.pendingCount}</span>
                </div>
              )}
              {systemStatus.webStatus?.permission && (
                <div className="flex justify-between">
                  <span>Web Permission:</span>
                  <span className={systemStatus.webStatus.permission === 'granted' ? 'text-green-600' : 'text-red-600'}>
                    {systemStatus.webStatus.permission}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Debug Panel */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
            >
              <Bug className="h-3 w-3" />
              {showDebug ? 'Hide Debug' : 'Show Debug'}
            </button>
            {showDebug && (
              <>
                <button
                  onClick={handleExportDebugData}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded text-blue-700"
                >
                  <Download className="h-3 w-3" />
                  Export
                </button>
                <button
                  onClick={handleClearDebugData}
                  className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 rounded text-red-700"
                >
                  Clear
                </button>
              </>
            )}
          </div>

          {showDebug && debugData && (
            <div className="p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-auto max-h-40">
              <div className="space-y-2">
                <div><strong>Recent Events:</strong></div>
                {debugData.events.slice(-5).map((event: any) => (
                  <div key={event.id} className="border-l-2 border-gray-600 pl-2">
                    <div className="font-mono text-yellow-300">{event.timestamp.split('T')[1]?.slice(0, 8)}</div>
                    <div>{event.component} → {event.action}</div>
                    {event.data && <div className="text-gray-400">{JSON.stringify(event.data, null, 2).slice(0, 100)}...</div>}
                  </div>
                ))}
                
                <div className="mt-3"><strong>Summary:</strong></div>
                <div>Total Events: {debugData.summary.totalEvents}</div>
                <div>Successful Attempts: {debugData.summary.successfulAttempts}</div>
                <div>Failed Attempts: {debugData.summary.failedAttempts}</div>
                <div>Current Timezone: {debugData.summary.currentTimezone?.userTimezone}</div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
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
      </CardContent>
    </Card>
  );
};
