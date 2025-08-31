import React, { useState, useEffect, useRef } from 'react';
import { Bell, Edit3, HelpCircle } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TranslatableText } from '@/components/translation/TranslatableText';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { fcmNotificationService } from '@/services/fcmNotificationService';
import { CustomTimeRemindersModal } from './CustomTimeRemindersModal';

interface NotificationPreferences {
  master_notifications: boolean;
  journaling_reminders: boolean;
}

interface NotificationPreferencesSectionProps {
  className?: string;
}

export function NotificationPreferencesSection({ className }: NotificationPreferencesSectionProps) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    master_notifications: false,
    journaling_reminders: true
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showCustomTimeModal, setShowCustomTimeModal] = useState(false);
  const [initialReminders, setInitialReminders] = useState<any[]>([]);

  // Enhanced tooltip state management
  const [openTooltips, setOpenTooltips] = useState<Record<string, boolean>>({});
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});

  // Load preferences from database
  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preferences, reminder_settings')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading notification preferences:', error);
        return;
      }

      if (data?.notification_preferences) {
        const prefs = data.notification_preferences as unknown as NotificationPreferences;
        setPreferences(prefs);
      }
      
      // Load reminder settings for custom time modal
      if (data?.reminder_settings) {
        const reminderSettings = data.reminder_settings as any;
        const reminders = Object.entries(reminderSettings).map(([key, value]: [string, any]) => ({
          id: key,
          enabled: value.enabled || false,
          time: value.time || '08:00',
          label: value.label || 'Reminder'
        }));
        setInitialReminders(reminders);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadReminderSettings = async () => {
    if (!user?.id) return [];
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('reminder_settings')
        .eq('id', user.id)
        .single();

      if (error || !data?.reminder_settings) {
        return [];
      }

      const reminderSettings = data.reminder_settings as any;
      return Object.entries(reminderSettings).map(([key, value]: [string, any]) => ({
        id: key,
        enabled: value.enabled || false,
        time: value.time || '08:00',
        label: value.label || 'Reminder'
      }));
    } catch (error) {
      console.error('Error loading reminder settings:', error);
      return [];
    }
  };

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          notification_preferences: newPreferences as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving preferences:', error);
        toast.error(<TranslatableText text="Failed to save notification preferences" forceTranslate={true} />);
        return false;
      }

      setPreferences(newPreferences);
      return true;
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error(<TranslatableText text="Failed to save notification preferences" forceTranslate={true} />);
      return false;
    }
  };

  const handleMasterToggle = async (enabled: boolean) => {
    if (enabled) {
      // Request permissions when master notifications are enabled
      console.log('[NotificationPreferencesSection] Master toggle ON - requesting permissions');
      
      try {
        const permissionResult = await fcmNotificationService.requestPermissions();
        console.log('[NotificationPreferencesSection] Permission result:', permissionResult);
        
        if (!permissionResult.granted) {
          toast.error(<TranslatableText text="Please allow notifications to enable this feature" forceTranslate={true} />);
          return;
        }
        
        // Auto-register device token after permission is granted
        const tokenResult = await fcmNotificationService.registerDeviceToken();
        if (!tokenResult.success) {
          console.warn('[NotificationPreferencesSection] Device token registration failed:', tokenResult.error);
        }
        
        const newPreferences = { 
          ...preferences, 
          master_notifications: true,
          journaling_reminders: true
        };
        const saved = await savePreferences(newPreferences);
        if (saved) {
          toast.success(<TranslatableText text="Notifications enabled successfully" forceTranslate={true} />);
        }
      } catch (error) {
        console.error('[NotificationPreferencesSection] Error enabling notifications:', error);
        toast.error(<TranslatableText text="Failed to enable notifications" forceTranslate={true} />);
      }
    } else {
      // Disable all notifications when master is turned off
      const newPreferences = {
        master_notifications: false,
        journaling_reminders: false
      };
      const saved = await savePreferences(newPreferences);
      if (saved) {
        toast.info(<TranslatableText text="All notifications disabled" forceTranslate={true} />);
      }
    }
  };

  const handleCategoryToggle = async (category: 'journaling_reminders', enabled: boolean) => {
    if (!preferences.master_notifications && enabled) {
      toast.warning(<TranslatableText text="Please enable master notifications first" forceTranslate={true} />);
      return;
    }

    const newPreferences = { ...preferences, [category]: enabled };
    const saved = await savePreferences(newPreferences);
    if (saved) {
      toast.success(<TranslatableText text="Preference updated successfully" forceTranslate={true} />);
    }
  };

  // Enhanced tooltip handlers
  const handleTooltipOpen = (tooltipId: string) => {
    // Clear any existing timeout for this tooltip
    if (timeoutRefs.current[tooltipId]) {
      clearTimeout(timeoutRefs.current[tooltipId]);
    }

    // Open the tooltip
    setOpenTooltips(prev => ({ ...prev, [tooltipId]: true }));

    // Set 3-second auto-close timer
    timeoutRefs.current[tooltipId] = setTimeout(() => {
      setOpenTooltips(prev => ({ ...prev, [tooltipId]: false }));
      delete timeoutRefs.current[tooltipId];
    }, 3000);
  };

  const handleTooltipClose = (tooltipId: string) => {
    // Clear timeout and close immediately
    if (timeoutRefs.current[tooltipId]) {
      clearTimeout(timeoutRefs.current[tooltipId]);
      delete timeoutRefs.current[tooltipId];
    }
    setOpenTooltips(prev => ({ ...prev, [tooltipId]: false }));
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <TranslatableText text="Notification Preferences" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse h-16 bg-muted rounded" />
            <div className="animate-pulse h-16 bg-muted rounded" />
            <div className="animate-pulse h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardContent className="p-4 space-y-2">
          {/* Master Notifications Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                <TranslatableText text="Master Notifications" />
              </span>
              <Tooltip 
                open={openTooltips['master'] || false}
                onOpenChange={(open) => open ? handleTooltipOpen('master') : handleTooltipClose('master')}
              >
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-0 h-4 w-4"
                    onClick={() => handleTooltipOpen('master')}
                  >
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent onPointerDownOutside={() => handleTooltipClose('master')}>
                  <p className="max-w-xs text-xs">
                    <TranslatableText text="Controls all notification types. When disabled, no notifications will be sent." />
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Switch
              checked={preferences.master_notifications}
              onCheckedChange={handleMasterToggle}
              disabled={isLoading}
            />
          </div>

          {/* Sub-category toggles - only show when master is enabled */}
          {preferences.master_notifications && (
            <>
              {/* Journaling Reminders */}
              <div className="flex items-center justify-between pl-6">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm">
                    <TranslatableText text="Journaling Reminders" />
                  </span>
                  <Tooltip 
                    open={openTooltips['journaling'] || false}
                    onOpenChange={(open) => open ? handleTooltipOpen('journaling') : handleTooltipClose('journaling')}
                  >
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="p-0 h-4 w-4"
                        onClick={() => handleTooltipOpen('journaling')}
                      >
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent onPointerDownOutside={() => handleTooltipClose('journaling')}>
                      <p className="max-w-xs text-xs">
                        <TranslatableText text="Daily reminders to write in your journal at times you choose" />
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* Edit button for custom time settings */}
                  {preferences.journaling_reminders && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-4 w-4 ml-1"
                      onClick={async () => {
                        const reminders = await loadReminderSettings();
                        setInitialReminders(reminders);
                        setShowCustomTimeModal(true);
                      }}
                    >
                      <Edit3 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                <Switch
                  checked={preferences.journaling_reminders}
                  onCheckedChange={(enabled) => handleCategoryToggle('journaling_reminders', enabled)}
                  disabled={isLoading}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Custom Time Reminders Modal */}
      <CustomTimeRemindersModal
        isOpen={showCustomTimeModal}
        onClose={() => setShowCustomTimeModal(false)}
        onSave={(reminders) => {
          console.log('Custom reminders saved:', reminders);
          loadPreferences(); // Reload to reflect changes
        }}
        initialReminders={initialReminders}
      />
    </TooltipProvider>
  );
}