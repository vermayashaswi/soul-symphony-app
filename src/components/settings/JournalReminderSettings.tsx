
import React, { useState } from 'react';
import { Bell, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { journalReminderService, JournalReminderTime } from '@/services/journalReminderService';
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
      </CardContent>
    </Card>
  );
};
