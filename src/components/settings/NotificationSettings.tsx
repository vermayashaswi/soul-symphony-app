
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { toast } from 'sonner';
import { 
  setupJournalReminder, 
  NotificationFrequency, 
  NotificationTime 
} from '@/services/notificationService';

interface NotificationSettingsProps {
  onSave: () => void;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ onSave }) => {
  const { translate } = useTranslation();
  const [enabled, setEnabled] = useState<boolean>(true);
  const [frequency, setFrequency] = useState<NotificationFrequency>('once');
  const [timePreferences, setTimePreferences] = useState<NotificationTime[]>(['evening']);
  
  // Load saved preferences from localStorage on component mount
  useEffect(() => {
    const storedEnabled = localStorage.getItem('notification_enabled');
    const storedFreq = localStorage.getItem('notification_frequency') as NotificationFrequency | null;
    const storedTimes = localStorage.getItem('notification_times');
    
    if (storedEnabled !== null) {
      setEnabled(storedEnabled === 'true');
    }
    
    if (storedFreq) {
      setFrequency(storedFreq);
    }
    
    if (storedTimes) {
      try {
        const times = JSON.parse(storedTimes) as NotificationTime[];
        if (Array.isArray(times) && times.length > 0) {
          setTimePreferences(times);
        }
      } catch (e) {
        console.error('Error parsing stored notification times:', e);
      }
    }
  }, []);
  
  const handleSave = async () => {
    try {
      // Save to localStorage for persistence
      localStorage.setItem('notification_enabled', enabled.toString());
      localStorage.setItem('notification_frequency', frequency);
      localStorage.setItem('notification_times', JSON.stringify(timePreferences));
      
      // Setup actual notifications (web or native)
      await setupJournalReminder(enabled, frequency, timePreferences);
      
      toast.success('Notification settings saved');
      onSave();
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Failed to save notification settings');
    }
  };
  
  const handleTimeToggle = (time: NotificationTime) => {
    setTimePreferences((prev) => {
      if (prev.includes(time)) {
        // Remove time if it exists
        return prev.filter(t => t !== time);
      } else {
        // Add time if it doesn't exist
        return [...prev, time];
      }
    });
  };
  
  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium"><TranslatableText text="Enable Notifications" /></h4>
          <p className="text-sm text-muted-foreground">
            <TranslatableText text="Receive reminders to journal" />
          </p>
        </div>
        <Switch 
          checked={enabled} 
          onCheckedChange={setEnabled} 
        />
      </div>
      
      {enabled && (
        <>
          <div className="space-y-4">
            <h4 className="text-sm font-medium"><TranslatableText text="Notification Frequency" /></h4>
            <RadioGroup value={frequency} onValueChange={value => setFrequency(value as NotificationFrequency)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="once" id="once" />
                <Label htmlFor="once"><TranslatableText text="Once daily" /></Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="twice" id="twice" />
                <Label htmlFor="twice"><TranslatableText text="Twice daily" /></Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="thrice" id="thrice" />
                <Label htmlFor="thrice"><TranslatableText text="Three times daily" /></Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-medium"><TranslatableText text="Preferred Times" /></h4>
            <p className="text-sm text-muted-foreground">
              <TranslatableText text="Select when you'd like to receive notifications" />
            </p>
            
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant={timePreferences.includes('morning') ? 'default' : 'outline'} 
                onClick={() => handleTimeToggle('morning')}
                className="justify-start"
              >
                <TranslatableText text="Morning (8 AM)" />
              </Button>
              <Button 
                variant={timePreferences.includes('afternoon') ? 'default' : 'outline'} 
                onClick={() => handleTimeToggle('afternoon')}
                className="justify-start"
              >
                <TranslatableText text="Afternoon (2 PM)" />
              </Button>
              <Button 
                variant={timePreferences.includes('evening') ? 'default' : 'outline'} 
                onClick={() => handleTimeToggle('evening')}
                className="justify-start"
              >
                <TranslatableText text="Evening (7 PM)" />
              </Button>
              <Button 
                variant={timePreferences.includes('night') ? 'default' : 'outline'} 
                onClick={() => handleTimeToggle('night')}
                className="justify-start"
              >
                <TranslatableText text="Night (10 PM)" />
              </Button>
            </div>
          </div>
        </>
      )}
      
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave}>
          <TranslatableText text="Save Settings" />
        </Button>
      </div>
    </div>
  );
};

export default NotificationSettings;
