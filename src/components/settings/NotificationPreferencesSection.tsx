import React, { useState, useEffect, useRef } from 'react';
import { Bell, Brain, Edit3, HelpCircle } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TranslatableText } from '@/components/translation/TranslatableText';
import { CustomTimeRemindersModal } from './CustomTimeRemindersModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fcmNotificationService } from '@/services/fcmNotificationService';
import { toast } from 'sonner';

interface NotificationPreferences {
  master_notifications: boolean;
  in_app_notifications: boolean;
  insightful_reminders: boolean;
  journaling_reminders: boolean;
}

interface NotificationPreferencesSectionProps {
  className?: string;
}

export function NotificationPreferencesSection({ className }: NotificationPreferencesSectionProps) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    master_notifications: false,
    in_app_notifications: true,
    insightful_reminders: true,
    journaling_reminders: true
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showCustomTimeModal, setShowCustomTimeModal] = useState(false);
  const [permissionState, setPermissionState] = useState<'checking' | 'granted' | 'denied' | 'error'>('checking');

  // Enhanced tooltip state management
  const [openTooltips, setOpenTooltips] = useState<Record<string, boolean>>({});
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});

  // Load preferences from database
  useEffect(() => {
    loadPreferences();
    checkPermissionStatus();
  }, [user]);

  const loadPreferences = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preferences')
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
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkPermissionStatus = async () => {
    try {
      const status = fcmNotificationService.checkPermissionStatus();
      setPermissionState(status === 'granted' ? 'granted' : 'denied');
    } catch (error) {
      console.error('Error checking permission:', error);
      setPermissionState('error');
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
      // Request permissions when enabling master notifications
      try {
        const result = await fcmNotificationService.requestPermissions();
        if (result.success) {
          setPermissionState('granted');
          const newPreferences = { ...preferences, master_notifications: true };
          const saved = await savePreferences(newPreferences);
          if (saved) {
            toast.success(<TranslatableText text="Notifications enabled successfully" forceTranslate={true} />);
          }
        } else {
          setPermissionState('denied');
          toast.error(<TranslatableText text="Notification permission denied" forceTranslate={true} />);
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
        setPermissionState('error');
        toast.error(<TranslatableText text="Failed to request notification permission" forceTranslate={true} />);
      }
    } else {
      // Disable all notifications when master is turned off
      const newPreferences = {
        master_notifications: false,
        in_app_notifications: false,
        insightful_reminders: false,
        journaling_reminders: false
      };
      const saved = await savePreferences(newPreferences);
      if (saved) {
        toast.info(<TranslatableText text="All notifications disabled" forceTranslate={true} />);
      }
    }
  };

  const handleCategoryToggle = async (category: keyof Omit<NotificationPreferences, 'master_notifications'>, enabled: boolean) => {
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

  const handleJournalingRemindersSave = async (reminders: any[]) => {
    try {
      await fcmNotificationService.saveReminderSettings({ reminders });
      toast.success(<TranslatableText text="Reminder settings saved successfully" forceTranslate={true} />);
      setShowCustomTimeModal(false);
    } catch (error) {
      console.error('Error saving reminders:', error);
      toast.error(<TranslatableText text="Failed to save reminder settings" forceTranslate={true} />);
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            <TranslatableText text="Notification Preferences" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="border rounded-lg p-2 space-y-2">
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
                {/* In-App Notifications */}
                <div className="flex items-center justify-between pl-6">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm">
                      <TranslatableText text="In-App Notifications" />
                    </span>
                    <Tooltip 
                      open={openTooltips['inapp'] || false}
                      onOpenChange={(open) => open ? handleTooltipOpen('inapp') : handleTooltipClose('inapp')}
                    >
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-0 h-4 w-4"
                          onClick={() => handleTooltipOpen('inapp')}
                        >
                          <HelpCircle className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent onPointerDownOutside={() => handleTooltipClose('inapp')}>
                        <p className="max-w-xs text-xs">
                          <TranslatableText text="Notifications that appear within the app's notification center" />
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={preferences.in_app_notifications}
                    onCheckedChange={(enabled) => handleCategoryToggle('in_app_notifications', enabled)}
                    disabled={isLoading}
                  />
                </div>

                {/* Insightful Reminders */}
                <div className="flex items-center justify-between pl-6">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm">
                      <TranslatableText text="Insightful Reminders" />
                    </span>
                    <Tooltip 
                      open={openTooltips['insights'] || false}
                      onOpenChange={(open) => open ? handleTooltipOpen('insights') : handleTooltipClose('insights')}
                    >
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-0 h-4 w-4"
                          onClick={() => handleTooltipOpen('insights')}
                        >
                          <HelpCircle className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent onPointerDownOutside={() => handleTooltipClose('insights')}>
                        <p className="max-w-xs text-xs">
                          <TranslatableText text="Smart notifications about your progress, insights, and wellness reminders" />
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={preferences.insightful_reminders}
                    onCheckedChange={(enabled) => handleCategoryToggle('insightful_reminders', enabled)}
                    disabled={isLoading}
                  />
                </div>

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
                    {preferences.journaling_reminders && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCustomTimeModal(true)}
                        className="p-0 h-4 w-4 ml-1"
                      >
                        <Edit3 className="h-3 w-3 text-muted-foreground hover:text-foreground" />
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
          </div>

          {/* Permission status indicator */}
          {permissionState !== 'checking' && (
            <div className="text-xs text-muted-foreground mt-2">
              <TranslatableText 
                text={`Permission Status: ${permissionState === 'granted' ? 'Granted' : 'Denied'}`} 
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Time Reminders Modal */}
      <CustomTimeRemindersModal
        isOpen={showCustomTimeModal}
        onClose={() => setShowCustomTimeModal(false)}
        onSave={handleJournalingRemindersSave}
      />
    </TooltipProvider>
  );
}