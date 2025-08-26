
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, Bell, Smartphone, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { unifiedNotificationService as enhancedNotificationService } from '@/services/unifiedNotificationService';
import { unifiedNotificationService as journalReminderService } from '@/services/unifiedNotificationService';
import { useTranslation } from '@/contexts/TranslationContext';

const JournalRemindersSettings: React.FC = () => {
  const { translate } = useTranslation();
  const [isEnabled, setIsEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('19:00');
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    loadSettings();
    checkEnvironment();
    checkPermissionStatus();
  }, []);

  const loadSettings = () => {
    const savedEnabled = localStorage.getItem('journalRemindersEnabled') === 'true';
    const savedTime = localStorage.getItem('journalReminderTime') || '19:00';
    
    setIsEnabled(savedEnabled);
    setReminderTime(savedTime);
  };

  const checkEnvironment = async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      setIsNative(Capacitor.isNativePlatform());
    } catch (error) {
      setIsNative(false);
    }
  };

  const checkPermissionStatus = async () => {
    try {
      const status = await enhancedNotificationService.checkPermissionStatus();
      setPermissionStatus(status);
    } catch (error) {
      console.error('Error checking permission status:', error);
    }
  };

  const handleEnableToggle = async (enabled: boolean) => {
    if (enabled && permissionStatus !== 'granted') {
      setIsLoading(true);
      try {
        const result = await enhancedNotificationService.requestPermissions();
        if (!result.granted) {
          toast.error(await translate?.('Permission denied. Please enable notifications in your device settings.', 'en') || 'Permission denied');
          setIsLoading(false);
          return;
        }
        setPermissionStatus('granted');
      } catch (error) {
        console.error('Permission request failed:', error);
        toast.error(await translate?.('Failed to request notification permission', 'en') || 'Permission request failed');
        setIsLoading(false);
        return;
      }
    }

    try {
      setIsEnabled(enabled);
      localStorage.setItem('journalRemindersEnabled', enabled.toString());

      if (enabled) {
        await scheduleReminder();
        toast.success(await translate?.('Journal reminders enabled', 'en') || 'Reminders enabled');
      } else {
        await journalReminderService.disableReminders();
        toast.success(await translate?.('Journal reminders disabled', 'en') || 'Reminders disabled');
      }
    } catch (error) {
      console.error('Error toggling reminders:', error);
      toast.error(await translate?.('Failed to update reminder settings', 'en') || 'Settings update failed');
      setIsEnabled(!enabled);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeChange = async (newTime: string) => {
    setReminderTime(newTime);
    localStorage.setItem('journalReminderTime', newTime);
    
    if (isEnabled) {
      try {
        await scheduleReminder();
        toast.success(await translate?.('Reminder time updated', 'en') || 'Time updated');
      } catch (error) {
        console.error('Error updating reminder time:', error);
        toast.error(await translate?.('Failed to update reminder time', 'en') || 'Time update failed');
      }
    }
  };

  const scheduleReminder = async () => {
    try {
      // Convert time to closest reminder slot
      const [hours] = reminderTime.split(':').map(Number);
      let timeSlot: 'morning' | 'afternoon' | 'evening' | 'night';
      
      if (hours >= 6 && hours < 12) {
        timeSlot = 'morning';
      } else if (hours >= 12 && hours < 17) {
        timeSlot = 'afternoon';
      } else if (hours >= 17 && hours < 22) {
        timeSlot = 'evening';
      } else {
        timeSlot = 'night';
      }
      
      await journalReminderService.requestPermissionsAndSetup([timeSlot]);
    } catch (error) {
      console.error('Error scheduling reminder:', error);
      throw error;
    }
  };

  const getPermissionBadge = () => {
    switch (permissionStatus) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500"><Bell className="w-3 h-3 mr-1" />Allowed</Badge>;
      case 'denied':
        return <Badge variant="destructive"><Bell className="w-3 h-3 mr-1" />Denied</Badge>;
      default:
        return <Badge variant="secondary"><Bell className="w-3 h-3 mr-1" />Not Set</Badge>;
    }
  };

  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return [`${hour}:00`, `${hour}:30`];
  }).flat();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Journal Reminders
        </CardTitle>
        <CardDescription>
          Set up daily reminders to help maintain your journaling habit
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Environment Info */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            {isNative ? <Smartphone className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
            <span className="text-sm font-medium">
              {isNative ? 'Native App' : 'Web App'}
            </span>
          </div>
          {getPermissionBadge()}
        </div>

        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="reminders-enabled" className="text-base font-medium">
              Enable Daily Reminders
            </Label>
            <p className="text-sm text-muted-foreground">
              Get notified when it's time to journal
            </p>
          </div>
          <Switch
            id="reminders-enabled"
            checked={isEnabled}
            onCheckedChange={handleEnableToggle}
            disabled={isLoading}
          />
        </div>

        {/* Time Selection */}
        {isEnabled && (
          <div className="space-y-3">
            <Label className="text-base font-medium">Reminder Time</Label>
            <Select value={reminderTime} onValueChange={handleTimeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              You'll receive a notification at this time every day
            </p>
          </div>
        )}

        {/* Permission Help */}
        {permissionStatus === 'denied' && (
          <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
            <h4 className="font-medium text-orange-800 mb-2">Notifications Blocked</h4>
            <p className="text-sm text-orange-700 mb-3">
              To receive journal reminders, please enable notifications in your device settings:
            </p>
            <ul className="text-sm text-orange-700 space-y-1 ml-4">
              <li>• Go to your device Settings</li>
              <li>• Find Soul Symphony in Apps</li>
              <li>• Enable Notifications</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JournalRemindersSettings;
