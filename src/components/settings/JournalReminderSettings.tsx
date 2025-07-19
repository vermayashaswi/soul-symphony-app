
import React, { useState, useEffect } from 'react';
import { Bell, Clock, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { journalReminderService, JournalReminderTime } from '@/services/journalReminderService';
import { enhancedNotificationService } from '@/services/enhancedNotificationService';
import { toast } from 'sonner';

const TIME_OPTIONS: { value: JournalReminderTime; label: string; time: string }[] = [
  { value: 'morning', label: 'Morning', time: '8:00 AM' },
  { value: 'afternoon', label: 'Afternoon', time: '2:00 PM' },
  { value: 'evening', label: 'Evening', time: '7:00 PM' },
  { value: 'night', label: 'Night', time: '10:00 PM' }
];

export const JournalReminderSettings: React.FC = () => {
  const [settings, setSettings] = useState(journalReminderService.getSettings());
  const [permissionState, setPermissionState] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadPermissionState();
  }, []);

  const loadPermissionState = async () => {
    const state = await enhancedNotificationService.checkPermissionStatus();
    setPermissionState(state);
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
        
        console.log('[JournalReminderSettings] User enabling reminders');
        const success = await journalReminderService.requestPermissionsAndSetup(settings.times);
        
        if (success) {
          setSettings(prev => ({ ...prev, enabled: true }));
          toast.success('Journal reminders enabled!');
          await loadPermissionState();
        } else {
          toast.error('Failed to enable reminders. Please check your notification settings.');
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

  const handleTestReminder = async () => {
    if (isTesting) return;
    
    setIsTesting(true);
    
    try {
      console.log('[JournalReminderSettings] Testing reminder');
      const success = await journalReminderService.testReminder();
      
      if (success) {
        toast.success('Test reminder sent! Check your notifications.');
      } else {
        toast.error('Failed to send test reminder. Please check your notification permissions.');
      }
    } catch (error) {
      console.error('[JournalReminderSettings] Error testing reminder:', error);
      toast.error('Error sending test reminder');
    } finally {
      setIsTesting(false);
    }
  };

  const getPermissionBadge = () => {
    switch (permissionState) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500">Granted</Badge>;
      case 'denied':
        return <Badge variant="destructive">Denied</Badge>;
      case 'unsupported':
        return <Badge variant="secondary">Not Supported</Badge>;
      default:
        return <Badge variant="secondary">Not Set</Badge>;
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
        {/* Permission Status */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">
              <TranslatableText text="Notification Permission" />
            </Label>
            <p className="text-xs text-muted-foreground">
              <TranslatableText text="Required to send journal reminders" />
            </p>
          </div>
          {getPermissionBadge()}
        </div>

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
            disabled={isLoading || permissionState === 'unsupported'}
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

        {/* Test Button */}
        {settings.enabled && permissionState === 'granted' && (
          <Button
            onClick={handleTestReminder}
            variant="outline"
            size="sm"
            disabled={isTesting}
            className="w-full"
          >
            <TestTube className="h-4 w-4 mr-2" />
            <TranslatableText text={isTesting ? "Sending Test..." : "Test Reminder"} />
          </Button>
        )}

        {/* Help Text */}
        {permissionState === 'denied' && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              <TranslatableText text="Notifications are blocked. Please allow notifications in your device settings and refresh the app." />
            </p>
          </div>
        )}

        {permissionState === 'unsupported' && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <TranslatableText text="Notifications are not supported on this device or browser." />
            </p>
          </div>
        )}

        {settings.enabled && settings.times.length === 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <TranslatableText text="Please select at least one reminder time to enable notifications." />
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
