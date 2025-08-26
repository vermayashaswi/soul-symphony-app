import React, { useState, useEffect } from 'react';
import { Bell, Clock, Plus, X, Bug } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { nativeNotificationService } from '@/services/nativeNotificationService';
import { timezoneNotificationHelper } from '@/services/timezoneNotificationHelper';
import { notificationDebugLogger } from '@/services/notificationDebugLogger';
import { NotificationDebugPanel } from './NotificationDebugPanel';
import { toast } from 'sonner';

export const ExactTimeReminderSettings: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [exactTimes, setExactTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState('12:00');
  const [isLoading, setIsLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  useEffect(() => {
    loadSettings();
    refreshStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await nativeNotificationService.getReminderSettings();
      if (settings && settings.reminders) {
        const times = settings.reminders.filter(r => r.enabled).map(r => r.time);
        setExactTimes(times);
        setIsEnabled(times.length > 0);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const refreshStatus = async () => {
    try {
      const status = await nativeNotificationService.getDetailedStatus();
      setSystemStatus(status);
    } catch (error) {
      console.error('Error refreshing status:', error);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      if (enabled) {
        if (exactTimes.length === 0) {
          toast.error('Please add at least one reminder time');
          setIsLoading(false);
          return;
        }
        
        console.log('[ExactTimeReminderSettings] Enabling reminders with exact times:', exactTimes);
        const result = await nativeNotificationService.requestPermissions();
        
        if (result.granted) {
          await scheduleExactTimes(exactTimes);
          setIsEnabled(true);
          toast.success('Exact time reminders enabled!');
        } else {
          toast.error('Failed to enable reminders. Please check notification permissions.');
        }
      } else {
        await nativeNotificationService.clearScheduledNotifications();
        setIsEnabled(false);
        toast.success('Reminders disabled');
      }
    } catch (error) {
      console.error('Error toggling reminders:', error);
      toast.error('Failed to update reminder settings');
    } finally {
      setIsLoading(false);
      refreshStatus();
    }
  };

  const scheduleExactTimes = async (times: string[]) => {
    const reminderSettings = {
      reminders: times.map((time, index) => ({
        id: `exact-${time}-${index}`,
        enabled: true,
        time: time, // Keep exact HH:MM format
        label: `Journal Reminder ${time}`
      }))
    };
    
    console.log('[ExactTimeReminderSettings] Scheduling exact times:', reminderSettings);
    await nativeNotificationService.saveAndScheduleSettings(reminderSettings);
  };

  const handleAddTime = async () => {
    if (!newTime || exactTimes.includes(newTime)) {
      toast.error('Time already exists or invalid');
      return;
    }
    
    const newTimes = [...exactTimes, newTime].sort();
    setExactTimes(newTimes);
    
    if (isEnabled) {
      await scheduleExactTimes(newTimes);
      toast.success(`Added reminder for ${newTime}`);
    }
    
    // Reset to a default time
    const nextHour = (parseInt(newTime.split(':')[0]) + 1) % 24;
    setNewTime(`${nextHour.toString().padStart(2, '0')}:00`);
    
    refreshStatus();
  };

  const handleRemoveTime = async (timeToRemove: string) => {
    const newTimes = exactTimes.filter(t => t !== timeToRemove);
    setExactTimes(newTimes);
    
    if (isEnabled && newTimes.length > 0) {
      await scheduleExactTimes(newTimes);
      toast.success(`Removed reminder for ${timeToRemove}`);
    } else if (isEnabled && newTimes.length === 0) {
      handleToggleEnabled(false);
    }
    
    refreshStatus();
  };

  const handleTestNotification = async () => {
    setIsLoading(true);
    try {
      const result = await nativeNotificationService.testNotification();
      if (result.success) {
        toast.success('Test notification sent! Check in 30 seconds.');
      } else {
        toast.error(`Test failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Test notification error:', error);
      toast.error('Test notification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!systemStatus) return <Badge variant="outline">Loading...</Badge>;
    
    switch (systemStatus.permissionState) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case 'denied':
        return <Badge variant="destructive">Denied</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <TranslatableText text="Exact Time Journal Reminders" />
          </div>
          <div className="flex gap-2">
            {getStatusBadge()}
            {systemStatus?.isNative && (
              <Badge variant="outline">Native</Badge>
            )}
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Set exact times (like 12:40 PM) for your journal reminders
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="exact-reminders-enabled" className="text-sm font-medium">
              <TranslatableText text="Enable Exact Time Reminders" />
            </Label>
            <p className="text-xs text-muted-foreground">
              <TranslatableText text="Get notified at specific times you choose" />
            </p>
          </div>
          <Switch
            id="exact-reminders-enabled"
            checked={isEnabled}
            onCheckedChange={handleToggleEnabled}
            disabled={isLoading}
          />
        </div>

        {/* Add New Time */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            <TranslatableText text="Add Reminder Time" />
          </Label>
          <div className="flex gap-2">
            <Input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              onClick={handleAddTime}
              disabled={isLoading}
              size="sm"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Current Times */}
        {exactTimes.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              <TranslatableText text="Scheduled Times" />
            </Label>
            <div className="space-y-2">
              {exactTimes.map((time, index) => {
                const [hour, minute] = time.split(':').map(Number);
                const nextOccurrence = timezoneNotificationHelper.getNextExactReminderTimeInTimezone(hour, minute);
                
                return (
                  <div 
                    key={`${time}-${index}`}
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-primary" />
                      <div>
                        <div className="font-mono text-sm font-medium">{time}</div>
                        <div className="text-xs text-muted-foreground">
                          Next: {timezoneNotificationHelper.formatTimeForUser(nextOccurrence, 'PPpp')}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleRemoveTime(time)}
                      disabled={isLoading}
                      size="sm"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* System Status */}
        {systemStatus && (
          <div className="space-y-3 p-3 bg-muted/50 border rounded-lg">
            <h4 className="text-sm font-medium">System Status</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span>Platform:</span>
                <span>{systemStatus.platform}</span>
              </div>
              <div className="flex justify-between">
                <span>Timezone:</span>
                <span className="font-mono">{systemStatus.userTimezone}</span>
              </div>
              <div className="flex justify-between">
                <span>Scheduled:</span>
                <span className="font-mono">{systemStatus.scheduledCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Permission:</span>
                <span className={systemStatus.permissionState === 'granted' ? 'text-green-600' : 'text-red-600'}>
                  {systemStatus.permissionState}
                </span>
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
            Test (30s)
          </Button>
          <Button
            onClick={refreshStatus}
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
            Debug
          </Button>
        </div>

        {/* Notifications */}
        {isEnabled && exactTimes.length === 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <TranslatableText text="Please add at least one reminder time to enable notifications." />
            </p>
          </div>
        )}

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

        {systemStatus?.platform === 'android' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Android Optimization Tips</strong>
            </p>
            <p className="text-xs text-blue-700">
              For reliable exact-time notifications: Disable battery optimization for this app and ensure "Do Not Disturb" allows notifications.
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