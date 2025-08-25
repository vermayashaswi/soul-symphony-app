import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Reminder {
  id: string;
  enabled: boolean;
  time: string;
  label: string;
}

interface CustomTimeRemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminders: Reminder[]) => void;
  initialReminders?: Reminder[];
}

export function CustomTimeRemindersModal({ 
  isOpen, 
  onClose, 
  onSave, 
  initialReminders = [] 
}: CustomTimeRemindersModalProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Initialize with existing reminders or default one
      if (initialReminders.length > 0) {
        setReminders(initialReminders);
      } else {
        setReminders([{
          id: '1',
          enabled: true,
          time: '08:00',
          label: 'Morning reflection'
        }]);
      }
    }
  }, [isOpen, initialReminders]);

  const addReminder = () => {
    const newReminder: Reminder = {
      id: Date.now().toString(),
      enabled: true,
      time: '20:00',
      label: 'Evening thoughts'
    };
    setReminders([...reminders, newReminder]);
  };

  const removeReminder = (id: string) => {
    if (reminders.length <= 1) {
      toast.error('You must have at least one reminder');
      return;
    }
    setReminders(reminders.filter(r => r.id !== id));
  };

  const updateReminder = (id: string, field: keyof Reminder, value: string | boolean) => {
    setReminders(reminders.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  const validateTime = (time: string): boolean => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  };

  const handleSave = async () => {
    // Validate all times
    const invalidTimes = reminders.filter(r => !validateTime(r.time));
    if (invalidTimes.length > 0) {
      toast.error('Please enter valid times in HH:MM format');
      return;
    }

    // Check for at least one enabled reminder
    const enabledReminders = reminders.filter(r => r.enabled);
    if (enabledReminders.length === 0) {
      toast.error('Please enable at least one reminder');
      return;
    }

    setIsLoading(true);
    
    try {
      // Update user's reminder settings in the database
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      const reminderSettings = {
        reminders: reminders
      };

      const { error } = await supabase
        .from('profiles')
        .update({ reminder_settings: reminderSettings as any })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving reminder settings:', error);
        toast.error('Failed to save reminder settings');
        return;
      }

      toast.success('Reminder settings saved successfully');
      onSave(reminders);
      onClose();
    } catch (error) {
      console.error('Error saving reminders:', error);
      toast.error('An error occurred while saving');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set your daily reminder timings here</DialogTitle>
          <DialogDescription>
            Customize when you'd like to receive your journal reminders. You can add multiple times throughout the day.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {reminders.map((reminder, index) => (
            <div key={reminder.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`reminder-${reminder.id}`} className="text-sm font-medium">
                    Reminder {index + 1}
                  </Label>
                  <Switch
                    id={`reminder-${reminder.id}`}
                    checked={reminder.enabled}
                    onCheckedChange={(checked) => updateReminder(reminder.id, 'enabled', checked)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor={`time-${reminder.id}`} className="text-xs text-muted-foreground">
                      Time
                    </Label>
                    <Input
                      id={`time-${reminder.id}`}
                      type="time"
                      value={reminder.time}
                      onChange={(e) => updateReminder(reminder.id, 'time', e.target.value)}
                      className="text-sm"
                      disabled={!reminder.enabled}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`label-${reminder.id}`} className="text-xs text-muted-foreground">
                      Label
                    </Label>
                    <Input
                      id={`label-${reminder.id}`}
                      value={reminder.label}
                      onChange={(e) => updateReminder(reminder.id, 'label', e.target.value)}
                      placeholder="e.g., Morning reflection"
                      className="text-sm"
                      disabled={!reminder.enabled}
                    />
                  </div>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeReminder(reminder.id)}
                disabled={reminders.length <= 1}
                className="p-2"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={addReminder}
            className="w-full"
            disabled={reminders.length >= 6}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Reminder
          </Button>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}