import React, { useState, useEffect } from 'react';
import { Bell, Clock, Settings, TestTube, RefreshCw, Check, X, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { unifiedNotificationService } from '@/services/unifiedNotificationService';
import { notificationSettingsService } from '@/services/notificationSettingsService';
import { JournalReminderTime, DEFAULT_TIME_MAPPINGS } from '@/types/notifications';
import { toast } from 'sonner';

interface ReminderTimeOption {
  value: JournalReminderTime;
  label: string;
  defaultTime: string;
}

const TIME_OPTIONS: ReminderTimeOption[] = [
  { value: 'morning', label: 'Morning', defaultTime: '08:00' },
  { value: 'afternoon', label: 'Afternoon', defaultTime: '14:00' },
  { value: 'evening', label: 'Evening', defaultTime: '19:00' },
  { value: 'night', label: 'Night', defaultTime: '22:00' }
];

export const EnhancedJournalReminderSettings: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [selectedTimes, setSelectedTimes] = useState<JournalReminderTime[]>([]);
  const [customTimes, setCustomTimes] = useState<{ [key in JournalReminderTime]: string }>({
    morning: '08:00',
    afternoon: '14:00',
    evening: '19:00',
    night: '22:00'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<any>(null);

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const settings = await notificationSettingsService.loadSettings();
      
      setIsEnabled(settings.enabled);
      setSelectedTimes(settings.times);
      
      // Load custom times from full database settings
      const fullSettings = await notificationSettingsService.loadFullSettings();
      if (fullSettings) {
        setCustomTimes({
          morning: fullSettings.morningTime || '08:00',
          afternoon: fullSettings.afternoonTime || '14:00',
          evening: fullSettings.eveningTime || '19:00',
          night: fullSettings.nightTime || '22:00'
        });
      }
      
      // Get notification status
      const status = await unifiedNotificationService.getNotificationStatus();
      setNotificationStatus(status);
      
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load reminder settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    if (isSaving) return;
    
    setIsSaving(true);
    
    try {
      if (enabled) {
        if (selectedTimes.length === 0) {
          toast.error('Please select at least one reminder time');
          setIsSaving(false);
          return;
        }
        
        // Save settings to backend first
        const settingsToSave = { enabled: true, times: selectedTimes };
        const saved = await notificationSettingsService.saveSettings(settingsToSave, customTimes);
        
        if (!saved) {
          toast.error('Failed to save settings to backend');
          setIsSaving(false);
          return;
        }
        
        const success = await unifiedNotificationService.enableReminders(selectedTimes, customTimes);
        
        if (success) {
          setIsEnabled(true);
          toast.success('Journal reminders enabled!');
          
          // Refresh status
          const status = await unifiedNotificationService.getNotificationStatus();
          setNotificationStatus(status);
        } else {
          toast.error('Failed to enable reminders. Please check your notification settings.');
        }
      } else {
        // Save disabled state to backend
        const settingsToSave = { enabled: false, times: [] };
        await notificationSettingsService.saveSettings(settingsToSave, customTimes);
        
        await unifiedNotificationService.disableReminders();
        setIsEnabled(false);
        toast.success('Journal reminders disabled');
      }
    } catch (error) {
      console.error('Error toggling reminders:', error);
      toast.error('Failed to update reminder settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimeToggle = async (time: JournalReminderTime, checked: boolean) => {
    const newTimes = checked 
      ? [...selectedTimes, time]
      : selectedTimes.filter(t => t !== time);
    
    setSelectedTimes(newTimes);
    
    // Save to backend immediately
    const settingsToSave = { enabled: isEnabled, times: newTimes };
    await notificationSettingsService.saveSettings(settingsToSave, customTimes);
    
    // If reminders are enabled, update them immediately
    if (isEnabled && !isSaving) {
      setIsSaving(true);
      try {
        if (newTimes.length > 0) {
          await unifiedNotificationService.enableReminders(newTimes, customTimes);
        } else {
          await handleToggleEnabled(false);
        }
      } catch (error) {
        console.error('Error updating times:', error);
        toast.error('Failed to update reminder times');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleCustomTimeChange = async (time: JournalReminderTime, newTime: string) => {
    const newCustomTimes = { ...customTimes, [time]: newTime };
    setCustomTimes(newCustomTimes);
    
    // Update the specific time
    const [hour, minute] = newTime.split(':').map(Number);
    await notificationSettingsService.updateCustomTime(time, hour, minute);
    
    // If reminders are enabled and this time is selected, refresh reminders
    if (isEnabled && selectedTimes.includes(time) && !isSaving) {
      setIsSaving(true);
      try {
        await unifiedNotificationService.enableReminders(selectedTimes, newCustomTimes);
        toast.success(`Updated ${time} reminder time`);
      } catch (error) {
        console.error('Error updating custom time:', error);
        toast.error('Failed to update reminder time');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleTestNotification = async () => {
    setIsLoading(true);
    try {
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
      const status = await unifiedNotificationService.getNotificationStatus();
      setNotificationStatus(status);
      toast.success('Status refreshed');
    } catch (error) {
      console.error('Error refreshing status:', error);
      toast.error('Failed to refresh status');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (condition: boolean, trueText: string, falseText: string) => (
    <Badge variant={condition ? "default" : "destructive"} className="text-xs">
      {condition ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
      {condition ? trueText : falseText}
    </Badge>
  );

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = new Date().setHours(hour, minute);
        const displayStr = new Date(displayTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        options.push({ value: timeStr, label: displayStr });
      }
    }
    return options;
  };

  if (isLoading && !notificationStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <TranslatableText text="Journal Reminders" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <TranslatableText text="Enhanced Journal Reminders" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        {notificationStatus && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System Status
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {getStatusBadge(notificationStatus.permissionsGranted, 'Permissions OK', 'No Permissions')}
              {getStatusBadge(notificationStatus.scheduledCount > 0, `${notificationStatus.scheduledCount} Scheduled`, 'None Scheduled')}
              {notificationStatus.exactAlarmPermission !== undefined && 
                getStatusBadge(notificationStatus.exactAlarmPermission, 'Exact Alarms OK', 'Exact Alarms Denied')
              }
              {notificationStatus.batteryOptimizationDisabled !== undefined && 
                getStatusBadge(notificationStatus.batteryOptimizationDisabled, 'Battery Optimized', 'Battery Issues')
              }
            </div>
            <div className="text-xs text-muted-foreground">
              Platform: {notificationStatus.platform} | Strategy: {notificationStatus.strategy}
            </div>
            {notificationStatus.error && (
              <div className="flex items-center gap-2 text-destructive text-xs">
                <AlertCircle className="h-3 w-3" />
                {notificationStatus.error}
              </div>
            )}
          </div>
        )}

        {/* Main Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="reminders-enabled" className="text-sm font-medium">
              <TranslatableText text="Enable Journal Reminders" />
            </Label>
            <p className="text-xs text-muted-foreground">
              <TranslatableText text="Get daily notifications to write in your journal" />
            </p>
          </div>
          <Switch
            id="reminders-enabled"
            checked={isEnabled}
            onCheckedChange={handleToggleEnabled}
            disabled={isSaving || isLoading}
          />
        </div>

        {/* Time Selection */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">
            <TranslatableText text="Reminder Times" />
          </Label>
          
          {TIME_OPTIONS.map(option => (
            <div key={option.value} className="space-y-2">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Switch
                    id={`time-${option.value}`}
                    checked={selectedTimes.includes(option.value)}
                    onCheckedChange={(checked) => handleTimeToggle(option.value, checked)}
                    disabled={isSaving || isLoading}
                  />
                  <div className="space-y-1">
                    <Label htmlFor={`time-${option.value}`} className="text-sm cursor-pointer">
                      <TranslatableText text={option.label} />
                    </Label>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Custom time
                    </div>
                  </div>
                </div>
                
                <Select
                  value={customTimes[option.value]}
                  onValueChange={(value) => handleCustomTimeChange(option.value, value)}
                  disabled={!selectedTimes.includes(option.value) || isSaving || isLoading}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generateTimeOptions().map(timeOption => (
                      <SelectItem key={timeOption.value} value={timeOption.value}>
                        {timeOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        {/* Validation Message */}
        {isEnabled && selectedTimes.length === 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <TranslatableText text="Please select at least one reminder time to enable notifications." />
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {(isEnabled || selectedTimes.length > 0) && (
          <div className="flex gap-2">
            <Button
              onClick={handleTestNotification}
              disabled={isLoading || isSaving}
              variant="outline"
              size="sm"
            >
              <TestTube className="h-4 w-4 mr-2" />
              Test Notification
            </Button>
            <Button
              onClick={handleRefreshStatus}
              disabled={isLoading || isSaving}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </Button>
          </div>
        )}

        {/* Android Optimization Tips */}
        {notificationStatus?.platform === 'android' && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="text-sm font-medium text-amber-800 mb-2">Android Optimization Tips</h4>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>• Disable battery optimization for this app in Android settings</li>
              <li>• Allow "Display over other apps" permission if prompted</li>
              <li>• Set notification importance to "High" in app settings</li>
              <li>• Enable "Exact alarms" permission for Android 12+</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};