import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Lock, Moon, Sun, Palette, HelpCircle, Shield, Mail, Check as CheckIcon, LogOut, Monitor, Pencil, Save, X, Clock, Calendar, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/use-theme';
import { setupJournalReminder, initializeCapacitorNotifications, NotificationFrequency, NotificationTime } from '@/services/notificationService';
import { enhancedNotificationService } from '@/services/enhancedNotificationService';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/integrations/supabase/client';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import SouloLogo from '@/components/SouloLogo';
import { ColorPicker } from '@/components/settings/ColorPicker';
import { SubscriptionBadge } from '@/components/settings/SubscriptionBadge';
import { SubscriptionManagement } from '@/components/settings/SubscriptionManagement';
import { SettingsErrorBoundary } from '@/components/settings/SettingsErrorBoundary';
import { SettingsLoadingWrapper } from '@/components/settings/SettingsLoadingWrapper';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { startOfDay, subDays, isWithinInterval } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { DeleteAllEntriesSection } from '@/components/settings/DeleteAllEntriesSection';
import { UserDebugInfo } from '@/components/settings/UserDebugInfo';


interface SettingItemProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children?: React.ReactNode;
}

function SettingItem({ icon: Icon, title, description, children }: SettingItemProps) {
  return (
    <div className="flex items-start justify-between py-4">
      <div className="flex gap-3">
        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium text-foreground">
            <TranslatableText text={title} />
          </h3>
          <p className="text-sm text-muted-foreground">
            <TranslatableText text={description} />
          </p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingsContent() {
  console.log('[Settings] SettingsContent rendering');
  
  // Defensive theme access
  let theme = 'light';
  let setTheme = (t: any) => {};
  let colorTheme = 'Calm';
  let setColorTheme = (t: any) => {};
  let customColor = '#3b82f6';
  let setCustomColor = (c: any) => {};
  let systemTheme = 'light';
  
  try {
    const themeData = useTheme();
    theme = themeData.theme;
    setTheme = themeData.setTheme;
    colorTheme = themeData.colorTheme;
    setColorTheme = themeData.setColorTheme;
    customColor = themeData.customColor;
    setCustomColor = themeData.setCustomColor;
    systemTheme = themeData.systemTheme;
  } catch (error) {
    console.warn('Theme provider not available, using defaults');
  }
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationTimes, setNotificationTimes] = useState<NotificationTime[]>(['evening']);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showNotificationDebug, setShowNotificationDebug] = useState(false);
  const [notificationPermissionState, setNotificationPermissionState] = useState<string>('checking');
  const [notificationDebugInfo, setNotificationDebugInfo] = useState<any>(null);
  const { user, signOut } = useAuth();
  const { 
    isPremium, 
    isTrialActive, 
    subscriptionStatus, 
    isLoading: subscriptionLoading,
    error: subscriptionError
  } = useSubscription();
  const [maxStreak, setMaxStreak] = useState(0);
  const { entries } = useJournalEntries(user?.id, 0, !!user);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { currentLanguage } = useTranslation();
  
  const [showFAQ, setShowFAQ] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerValue, setColorPickerValue] = useState(customColor);
  
  const [displayName, setDisplayName] = useState<string>('');
  const [originalDisplayName, setOriginalDisplayName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);
  
  const MAX_NAME_LENGTH = 25;
  
  const colorThemes = [
    { name: 'Default', color: 'bg-blue-500' },
    { name: 'Calm', color: 'bg-violet-500' },
    { name: 'Soothing', color: 'bg-pink-200' },
    { name: 'Energy', color: 'bg-amber-400' },
    { name: 'Focus', color: 'bg-emerald-400' },
  ];

  const timeOptions: { label: string; value: NotificationTime }[] = [
    { label: 'Morning (8:00 AM)', value: 'morning' },
    { label: 'Afternoon (2:00 PM)', value: 'afternoon' },
    { label: 'Evening (7:00 PM)', value: 'evening' },
    { label: 'Night (10:00 PM)', value: 'night' },
  ];

  const { resetTutorial } = useTutorial();

  // Initialize notification state and check permissions using enhanced service
  useEffect(() => {
    const initializeNotifications = async () => {
      console.log('[Settings] Initializing notifications with enhanced service');
      
      try {
        // Get current permission status
        const permissionState = await enhancedNotificationService.checkPermissionStatus();
        console.log('[Settings] Current permission state:', permissionState);
        setNotificationPermissionState(permissionState);
        
        // Get debug information
        const debugInfo = await enhancedNotificationService.getPermissionInfo();
        console.log('[Settings] Debug info:', debugInfo);
        setNotificationDebugInfo(debugInfo);
        
        // Load stored notification settings
        const enabled = localStorage.getItem('notification_enabled') === 'true';
        const times = localStorage.getItem('notification_times');
        
        if (enabled && permissionState === 'granted') {
          setNotificationsEnabled(true);
        }
        
        if (times) {
          try {
            const parsedTimes = JSON.parse(times) as NotificationTime[];
            if (Array.isArray(parsedTimes) && parsedTimes.length > 0) {
              setNotificationTimes(parsedTimes);
            }
          } catch (e) {
            console.error('Error parsing notification times from localStorage', e);
          }
        }
      } catch (error) {
        console.error('[Settings] Error initializing notifications:', error);
        setNotificationPermissionState('error');
      }
    };

    initializeNotifications();
  }, []);

  // Debug state logging
  useEffect(() => {
    console.log('[Settings] State update:', {
      user: user?.id,
      subscriptionLoading,
      subscriptionError,
      isLoadingProfile,
      entriesCount: entries.length,
      theme,
      colorTheme,
      notificationPermissionState,
      notificationsEnabled
    });
  }, [user, subscriptionLoading, subscriptionError, isLoadingProfile, entries.length, theme, colorTheme, notificationPermissionState, notificationsEnabled]);

  useEffect(() => {
    const calculateMaxStreak = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('Journal Entries')
            .select('created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
            
          if (error) {
            console.error("Error fetching entries for streak:", error);
            return;
          }
          
          if (!data || data.length === 0) {
            setMaxStreak(0);
            return;
          }
          
          const sortedEntries = [...data].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          
          const entriesByDate = sortedEntries.reduce((acc, entry) => {
            const dateKey = startOfDay(new Date(entry.created_at)).toISOString();
            if (!acc[dateKey]) {
              acc[dateKey] = [];
            }
            acc[dateKey].push(entry);
            return acc;
          }, {} as Record<string, any[]>);
          
          const dates = Object.keys(entriesByDate).sort();
          
          let currentStreak = 1;
          let maxStreak = 1;
          
          for (let i = 1; i < dates.length; i++) {
            const currentDate = new Date(dates[i]);
            const prevDate = new Date(dates[i-1]);
            
            const timeDiff = currentDate.getTime() - prevDate.getTime();
            const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24));
            
            if (daysDiff === 1) {
              currentStreak++;
              maxStreak = Math.max(maxStreak, currentStreak);
            } else {
              currentStreak = 1;
            }
          }
          
          setMaxStreak(maxStreak);
        } catch (error) {
          console.error("Error calculating max streak:", error);
        }
      }
    };
    
    calculateMaxStreak();
  }, [user, entries]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        try {
          setIsLoadingProfile(true);
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .single();
          
          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching profile', error);
          } else if (data) {
            setDisplayName(data.display_name || '');
            setOriginalDisplayName(data.display_name || '');
          }
        } catch (error) {
          console.error('Error in profile fetching', error);
        } finally {
          setIsLoadingProfile(false);
        }
      }
    };
    
    fetchUserProfile();
  }, [user]);

  const handleContactSupport = () => {
    const subject = encodeURIComponent("Help me, I don't want to be SOuLO right now");
    const mailtoLink = `mailto:support@soulo.online?subject=${subject}`;
    window.open(mailtoLink, '_blank');
  };
  
  const handleLogout = async () => {
    try {
      toast.info(<TranslatableText text="Logging out..." forceTranslate={true} />);
      await signOut();
    } catch (error) {
      console.error('Error logging out from Settings page:', error);
      window.location.href = '/';
    }
  };

  const validateDisplayName = (name: string): boolean => {
    if (name.length > MAX_NAME_LENGTH) {
      setNameError(`Display name cannot exceed ${MAX_NAME_LENGTH} characters`);
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setDisplayName(newName);
    validateDisplayName(newName);
  };

  const saveDisplayName = async () => {
    if (!user) return;
    
    if (!validateDisplayName(displayName.trim())) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          display_name: displayName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) {
        toast.error(<TranslatableText text="Failed to update display name" forceTranslate={true} />);
        console.error(error);
        return;
      }
      
      setOriginalDisplayName(displayName.trim());
      toast.success(<TranslatableText text="Display name updated successfully" forceTranslate={true} />);
      setIsEditingName(false);
    } catch (error) {
      console.error('Error updating display name', error);
      toast.error(<TranslatableText text="Something went wrong" forceTranslate={true} />);
    }
  };

  const cancelNameEdit = () => {
    setDisplayName(originalDisplayName);
    setIsEditingName(false);
    setNameError(null);
  };
  
  const handleToggleNotifications = async (checked: boolean) => {
    console.log('[Settings] Enhanced notification toggle clicked:', checked);
    
    if (checked) {
      try {
        console.log('[Settings] Requesting notification permission via enhanced service...');
        
        const result = await enhancedNotificationService.requestPermissions();
        console.log('[Settings] Enhanced permission result:', result);
        
        // Update debug info after permission request
        const newDebugInfo = await enhancedNotificationService.getPermissionInfo();
        setNotificationDebugInfo(newDebugInfo);
        setNotificationPermissionState(result.state);
        
        if (result.granted) {
          setNotificationsEnabled(true);
          setShowNotificationSettings(true);
          localStorage.setItem('notification_enabled', 'true');
          
          toast.success(
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>
                <TranslatableText text="Notifications enabled! Set your preferences." forceTranslate={true} />
                {result.plugin && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Using {result.plugin}
                  </div>
                )}
              </span>
            </div>
          );
        } else {
          setNotificationsEnabled(false);
          
          let errorMessage = "Notification permission denied. ";
          if (result.error) {
            errorMessage += result.error;
          } else if (result.plugin) {
            errorMessage += `${result.plugin} permission was denied.`;
          }
          errorMessage += " Please check your device settings.";
          
          toast.error(
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>
                <TranslatableText text={errorMessage} forceTranslate={true} />
              </span>
            </div>
          );
        }
      } catch (error) {
        console.error('[Settings] Error in notification toggle:', error);
        setNotificationsEnabled(false);
        setNotificationPermissionState('error');
        
        toast.error(
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span>
              <TranslatableText text="Failed to request notification permission" forceTranslate={true} />
            </span>
          </div>
        );
      }
    } else {
      setNotificationsEnabled(false);
      setNotificationPermissionState(await enhancedNotificationService.checkPermissionStatus());
      localStorage.removeItem('notification_enabled');
      localStorage.removeItem('notification_times');
      
      toast.info(<TranslatableText text="Notifications disabled" forceTranslate={true} />);
    }
  };
  
  const handleTimeChange = (time: NotificationTime) => {
    setNotificationTimes(prev => {
      if (prev.includes(time)) {
        return prev.filter(t => t !== time);
      }
      return [...prev, time];
    });
  };
  
  const applyNotificationSettings = () => {
    if (notificationTimes.length === 0) {
      toast.error(<TranslatableText text="Please select at least one time for notifications" forceTranslate={true} />);
      return;
    }
    
    // Store settings
    localStorage.setItem('notification_enabled', 'true');
    localStorage.setItem('notification_times', JSON.stringify(notificationTimes));
    
    // Set up reminders using existing service
    setupJournalReminder(true, 'once', notificationTimes);
    
    toast.success(<TranslatableText text="Notification settings saved" forceTranslate={true} />);
    setShowNotificationSettings(false);
  };

  // Helper function to get next reminder time for debugging
  const getNextReminderTime = (time: string): Date | null => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let hour = 0;
    switch (time) {
      case 'morning': hour = 8; break;
      case 'afternoon': hour = 14; break;
      case 'evening': hour = 19; break;
      case 'night': hour = 22; break;
      default: return null;
    }
    
    const nextTime = new Date(now);
    nextTime.setHours(hour, 0, 0, 0);
    
    // If the time has passed today, set it for tomorrow
    if (nextTime <= now) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
    
    return nextTime;
  };

  const cancelNotificationSettings = () => {
    // Get the current state from localStorage to determine what to reset to
    const storedEnabled = localStorage.getItem('notification_enabled') === 'true';
    const storedTimes = localStorage.getItem('notification_times');
    
    // Reset to the stored state
    setNotificationsEnabled(storedEnabled);
    
    if (storedTimes) {
      try {
        const parsedTimes = JSON.parse(storedTimes) as NotificationTime[];
        if (Array.isArray(parsedTimes) && parsedTimes.length > 0) {
          setNotificationTimes(parsedTimes);
        } else {
          setNotificationTimes(['evening']);
        }
      } catch (e) {
        setNotificationTimes(['evening']);
      }
    } else {
      setNotificationTimes(['evening']);
    }
    
    setShowNotificationSettings(false);
  };
  
  const getNotificationSummary = () => {
    if (!notificationsEnabled) return <TranslatableText text="Disabled" />;
    
    const timeLabels = notificationTimes.map(time => {
      return {
        'morning': 'Morning',
        'afternoon': 'Afternoon', 
        'evening': 'Evening',
        'night': 'Night'
      }[time];
    }).join(", ");
    
    return (
      <div className="flex flex-wrap items-center gap-1">
        <TranslatableText text={timeLabels} />
      </div>
    );
  };

  const getPermissionStatusIcon = () => {
    switch (notificationPermissionState) {
      case 'granted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'denied':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'unsupported':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPermissionStatusText = () => {
    switch (notificationPermissionState) {
      case 'granted':
        return 'Granted';
      case 'denied':
        return 'Denied';
      case 'unsupported':
        return 'Not Supported';
      case 'error':
        return 'Error';
      case 'checking':
        return 'Checking...';
      default:
        return 'Not Set';
    }
  };

  const handleTestNotification = async () => {
    try {
      console.log('[Settings] Testing notification...');
      const success = await enhancedNotificationService.testNotification();
      
      if (success) {
        toast.success(<TranslatableText text="Test notification sent!" forceTranslate={true} />);
      } else {
        toast.error(<TranslatableText text="Failed to send test notification" forceTranslate={true} />);
      }
    } catch (error) {
      console.error('[Settings] Error testing notification:', error);
      toast.error(<TranslatableText text="Error testing notification" forceTranslate={true} />);
    }
  };

  const applyCustomColor = () => {
    setCustomColor(colorPickerValue);
    setColorTheme('Custom');
    toast.success(<TranslatableText text="Custom color applied" forceTranslate={true} />);
    setShowColorPicker(false);
  };

  console.log('[Settings] About to render with loading states:', {
    subscriptionLoading,
    isLoadingProfile,
    subscriptionError
  });

  return (
    <SettingsLoadingWrapper 
      isLoading={subscriptionLoading || isLoadingProfile} 
      error={subscriptionError}
    >
      <div className="min-h-screen pb-20">
        <div className={cn("max-w-3xl mx-auto px-4", isMobile ? "pt-0" : "pt-2")}>
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2 text-theme-color">
              <TranslatableText text="Settings" forceTranslate={true} />
            </h1>
            <p className="text-muted-foreground">
              <TranslatableText text="Personalize your SOuLO experience" />
            </p>
          </div>
          
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-background rounded-xl p-6 shadow-sm border"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-theme-color">
                  <TranslatableText text="Your Profile" />
                </h2>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  <TranslatableText text="Logout" />
                </Button>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                <div className="flex flex-col items-center">
                  <Avatar className="h-24 w-24 mb-4">
                    <AvatarImage 
                      src={user?.user_metadata?.avatar_url} 
                      optimizeSize={192}
                    />
                    <AvatarFallback>
                      {user?.email?.substring(0, 2).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                
                <div className="flex-1 space-y-4 text-center sm:text-left">
                  {isEditingName ? (
                    <div className="flex flex-col space-y-2">
                      <Input
                        value={displayName}
                        onChange={handleNameChange}
                        placeholder="Enter your display name"
                        className={cn("max-w-xs", nameError && "border-red-500")}
                        autoFocus
                        maxLength={MAX_NAME_LENGTH}
                      />
                      {nameError && (
                        <p className="text-xs text-red-500">{nameError}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={cancelNameEdit}
                          className="flex items-center gap-1"
                        >
                          <X className="h-3 w-3" />
                          <TranslatableText text="Cancel" />
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={saveDisplayName}
                          className="flex items-center gap-1 bg-theme hover:bg-theme/90"
                          disabled={!displayName.trim() || displayName.trim() === originalDisplayName || !!nameError || displayName.length > MAX_NAME_LENGTH}
                        >
                          <Save className="h-3 w-3" />
                          <TranslatableText text="Save" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      <h3 className="text-xl font-semibold text-foreground">
                        {isLoadingProfile ? <TranslatableText text="Loading..." /> : 
                         originalDisplayName || user?.user_metadata?.full_name || <TranslatableText text="User" />}
                      </h3>
                      <SubscriptionBadge
                        isPremium={isPremium}
                        isTrialActive={isTrialActive}
                        subscriptionStatus={subscriptionStatus}
                        isLoading={subscriptionLoading}
                        size="sm"
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => setIsEditingName(true)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <p className="text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </motion.div>
            
            <SubscriptionManagement />
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-background rounded-xl p-6 shadow-sm border"
            >
              <h2 className="text-xl font-semibold mb-4 text-theme-color">
                <TranslatableText text="Appearance" />
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block text-foreground">
                    <TranslatableText text="Theme Mode" />
                  </label>
                  <div className="flex p-1 bg-secondary rounded-full w-fit">
                    <button
                      onClick={() => {
                        setTheme('light');
                        toast.success(<TranslatableText text="Light theme applied" forceTranslate={true} />);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all",
                        theme === 'light' ? "bg-background shadow-sm" : "hover:text-foreground text-muted-foreground"
                      )}
                    >
                      <Sun className="h-4 w-4" />
                      <TranslatableText text="Light" />
                    </button>
                    <button
                      onClick={() => {
                        setTheme('dark');
                        toast.success(<TranslatableText text="Dark theme applied" forceTranslate={true} />);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all",
                        theme === 'dark' ? "bg-background shadow-sm" : "hover:text-foreground text-muted-foreground"
                      )}
                    >
                      <Moon className="h-4 w-4" />
                      <TranslatableText text="Dark" />
                    </button>
                    <button
                      onClick={() => {
                        setTheme('system');
                        toast.success(<TranslatableText text="System theme applied" forceTranslate={true} />);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all",
                        theme === 'system' ? "bg-background shadow-sm" : "hover:text-foreground text-muted-foreground"
                      )}
                    >
                      <Monitor className="h-4 w-4 mr-1" />
                      <span>
                        <TranslatableText text="System" />
                        {theme === 'system' && ` (${systemTheme})`}
                      </span>
                    </button>
                  </div>
                  {theme === 'system' && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <TranslatableText text="Using your device's" /> {systemTheme} <TranslatableText text="theme preference" />
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block text-theme-color">
                    <TranslatableText text="Color Theme" />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {colorThemes.map((themeOption) => (
                      <button
                        key={themeOption.name}
                        onClick={() => {
                          setColorTheme(themeOption.name as any);
                          toast.success(
                            <TranslatableText 
                              text={`${themeOption.name} theme applied`} 
                              forceTranslate={true} 
                            />
                          );
                        }}
                        className={cn(
                          "flex flex-col items-center gap-1.5 transition-all",
                        )}
                      >
                        <div
                          className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all",
                            themeOption.color,
                            colorTheme === themeOption.name 
                              ? "border-foreground ring-2 ring-background ring-offset-2" 
                              : "border-muted"
                          )}
                        >
                          {colorTheme === themeOption.name && (
                            <CheckIcon className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <span className={cn(
                          "text-xs",
                          colorTheme === themeOption.name 
                            ? "text-theme-color font-medium" 
                            : "text-foreground"
                        )}>
                          <TranslatableText text={themeOption.name} />
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex items-center gap-2"
                      onClick={() => {
                        setColorPickerValue(customColor);
                        setShowColorPicker(true);
                      }}
                    >
                      <Palette className="h-4 w-4" />
                      <TranslatableText text="Customize Your Color" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Enhanced Notifications Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-background rounded-xl p-6 shadow-sm border"
            >
              <h2 className="text-xl font-semibold mb-4 text-theme-color">
                <TranslatableText text="Preferences" />
              </h2>
              
              <div className="space-y-3 divide-y">
                <SettingItem
                  icon={Bell}
                  title="Journal Reminders"
                  description={
                    notificationsEnabled 
                      ? ""
                      : "Get reminders to journal and stay on track"
                  }
                >
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={notificationsEnabled}
                      onCheckedChange={handleToggleNotifications}
                    />
                    {notificationsEnabled && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowNotificationSettings(true)}
                      >
                        <TranslatableText text="Customize" />
                      </Button>
                    )}
                  </div>
                </SettingItem>
                
                {/* Permission Status Display */}
                <div className="pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      <TranslatableText text="Permission Status" />
                    </span>
                    <div className="flex items-center gap-2">
                      {getPermissionStatusIcon()}
                      <span className="text-foreground">
                        <TranslatableText text={getPermissionStatusText()} />
                      </span>
                    </div>
                  </div>
                  
                  {notificationPermissionState === 'granted' && (
                    <div className="mt-2 flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleTestNotification}
                      >
                        <TranslatableText text="Test Notification" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowNotificationDebug(true)}
                      >
                        <TranslatableText text="Debug Info" />
                      </Button>
                      <UserDebugInfo />
                    </div>
                  )}
                </div>
                
                {notificationsEnabled && (
                  <div className="pt-2 text-sm text-muted-foreground">
                    {getNotificationSummary()}
                  </div>
                )}
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="bg-background rounded-xl p-6 shadow-sm border"
            >
              <h2 className="text-xl font-semibold mb-4 text-theme-color">
                <TranslatableText text="Help & Support" />
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="h-auto py-6 rounded-xl justify-start"
                  onClick={() => {
                    setShowFAQ(true);
                  }}
                >
                  <div className="flex flex-col items-start text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <HelpCircle className="h-4 w-4 text-theme-color" />
                      <span className="font-medium text-foreground">
                        <TranslatableText text="FAQ" />
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <TranslatableText text="Frequently asked questions" />
                    </p>
                  </div>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="h-auto py-6 rounded-xl justify-start"
                  onClick={() => {
                    setShowPrivacyPolicy(true);
                  }}
                >
                  <div className="flex flex-col items-start text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-theme-color" />
                      <span className="font-medium text-foreground">
                        <TranslatableText text="Privacy Policy" />
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <TranslatableText text="How we protect your data" />
                    </p>
                  </div>
                </Button>
              </div>
              
              <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                <Button 
                  variant="default" 
                  className="gap-2 bg-theme-color hover:bg-theme-color/90 flex-1 sm:flex-none whitespace-normal text-center min-h-[44px] px-6" 
                  onClick={handleContactSupport}
                >
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="leading-tight">
                    <TranslatableText text="Contact Support" />
                  </span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="gap-2 border-theme-color text-theme-color hover:bg-theme-color/10 flex-1 sm:flex-none whitespace-normal text-center min-h-[44px] px-6" 
                  onClick={resetTutorial}
                >
                  <RefreshCw className="h-4 w-4 flex-shrink-0" />
                  <span className="leading-tight">
                    <TranslatableText text="Restart Tutorial" />
                  </span>
                </Button>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="bg-background rounded-xl p-6 shadow-sm border"
            >
              <h2 className="text-xl font-semibold mb-4 text-theme-color">
                <TranslatableText text="Data Management" />
              </h2>
              
              <DeleteAllEntriesSection />
            </motion.div>
            
            
            <div className="py-4 text-center text-sm text-muted-foreground">
              <p className="flex items-center justify-center gap-1">
                <SouloLogo size="small" useColorTheme={true} /> v1.0.0
              </p>
            </div>
          </div>
        </div>
        
        <Dialog 
          open={showFAQ} 
          onOpenChange={(open) => {
            setShowFAQ(open);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-xl text-theme-color">
                <TranslatableText text="Frequently Asked Questions" />
              </DialogTitle>
              <DialogDescription>
                <TranslatableText text="Find answers to common questions about SOuLO" />
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6 py-2">
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="What is SOuLO?" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="SOuLO is an AI-powered journaling app designed to help you track, analyze, and understand your emotions through voice recordings and text entries. Our app creates a safe space for self-reflection and personal growth." />
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="How do I create a journal entry?" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="You can create a journal entry by navigating to the Journal tab and clicking on the '+' button. You can either type your entry or use the voice recording feature, which will automatically transcribe and analyze your spoken thoughts." />
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="Is my data private?" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Yes, your privacy is our top priority. All journal entries are encrypted and only accessible to you. We do not share or sell your personal data with third parties. See our Privacy Policy for more details." />
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="How does the emotion analysis work?" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Our AI technology analyzes the text and tone of your journal entries to identify emotions and themes. It recognizes patterns in your writing or speech to provide insights about your emotional state and recurring topics." />
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="Can I chat with my journal?" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Yes! One of SOuLO's unique features is the ability to chat with your journal. You can ask questions about your mood patterns, seek insights about your emotional trends, or get personalized reflections based on your journal entries." />
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="What is a journal streak?" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="A journal streak represents the number of consecutive days you've created at least one journal entry. It's a way to track your consistency and build a regular journaling habit." />
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="How do I set up daily reminders?" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="You can enable daily reminders by toggling on the Notifications option in the Settings page. You'll need to grant notification permissions to the app for this feature to work." />
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="How do I customize the app's appearance?" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="In the Settings page, you can switch between light and dark mode, and choose from several color themes. You can even create your own custom color theme to personalize your experience." />
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="How do I view my emotional insights?" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Navigate to the Insights tab to see visualizations of your emotional patterns over time. You can view your mood calendar, emotion distribution, and recurring themes from your journal entries." />
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="Is SOuLO available on all devices?" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="SOuLO is available as a web application that works on all modern browsers. The responsive design ensures a great experience on both desktop and mobile devices." />
                  </p>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
        
        <Dialog 
          open={showPrivacyPolicy} 
          onOpenChange={(open) => {
            setShowPrivacyPolicy(open);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-xl text-theme-color">
                <TranslatableText text="Privacy Policy" />
              </DialogTitle>
              <DialogDescription>
                <TranslatableText text="How we protect your data and respect your privacy" />
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6 py-2">
                <p className="text-sm text-muted-foreground">
                  <TranslatableText text="Last Updated" />: April 8, 2025
                </p>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="Introduction" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Welcome to SOuLO ('we,' 'our,' or 'us'). We are committed to protecting your privacy and handling your data with transparency and care. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our journaling application." />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="This Privacy Policy is available in the app settings" />
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="Information We Collect" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <strong><TranslatableText text="Account Information:" /></strong> <TranslatableText text="When you create an account, we collect your email address, name, and password." />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong><TranslatableText text="Journal Entries:" /></strong> <TranslatableText text="We store the content of your journal entries, including text and voice recordings." />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong><TranslatableText text="Usage Data:" /></strong> <TranslatableText text="We collect information about how you interact with our application, such as features used, time spent, and actions taken." />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong><TranslatableText text="Device Information:" /></strong> <TranslatableText text="We collect information about your device, including IP address, browser type, and operating system." />
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="How We Use Your Information" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <strong><TranslatableText text="Provide and Improve Services:" /></strong> <TranslatableText text="We use your information to deliver our journaling features, analyze your entries, and generate insights." />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong><TranslatableText text="Personalization:" /></strong> <TranslatableText text="We personalize your experience based on your preferences and usage patterns." />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong><TranslatableText text="Communication:" /></strong> <TranslatableText text="We may send you notifications, updates, and support messages." />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong><TranslatableText text="Research and Development:" /></strong> <TranslatableText text="We use anonymized data to improve our AI algorithms and develop new features." />
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="Data Security" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security." />
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="Your Rights" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Depending on your location, you may have rights regarding your personal information, including:" />
                  </p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    <li><TranslatableText text="Access to your personal data" /></li>
                    <li><TranslatableText text="Correction of inaccurate data" /></li>
                    <li><TranslatableText text="Deletion of your data" /></li>
                    <li><TranslatableText text="Restriction of processing" /></li>
                    <li><TranslatableText text="Data portability" /></li>
                    <li><TranslatableText text="Objection to processing" /></li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-2">
                    <TranslatableText text="To exercise these rights, please contact us at support@soulo.online." />
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-semibold">
                    <TranslatableText text="Contact Us" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:" />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Email" />: support@soulo.online<br />
                    <TranslatableText text="Address" />: 123 Journal Street, San Francisco, CA 94105, USA
                  </p>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
        
        <Dialog
          open={showNotificationSettings}
          onOpenChange={(open) => {
            if (!open) {
              cancelNotificationSettings();
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                <TranslatableText text="Notification Settings" />
              </DialogTitle>
              <DialogDescription>
                <TranslatableText text="Choose when you want to receive journal reminders" />
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <h3 className="font-medium text-sm">
                  <TranslatableText text="Reminder Times" />
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {timeOptions.map(option => (
                    <div 
                      key={option.value} 
                      className={cn(
                        "border rounded-md px-3 py-2 flex items-center space-x-2 cursor-pointer",
                        notificationTimes.includes(option.value) 
                          ? "border-primary bg-primary/10" 
                          : "border-input"
                      )}
                      onClick={() => handleTimeChange(option.value)}
                    >
                      <Checkbox 
                        checked={notificationTimes.includes(option.value)} 
                        onCheckedChange={() => handleTimeChange(option.value)}
                        id={`time-${option.value}`}
                      />
                      <Label 
                        htmlFor={`time-${option.value}`} 
                        className="flex-1 cursor-pointer text-sm"
                      >
                        <TranslatableText text={option.label} />
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={cancelNotificationSettings}
              >
                <TranslatableText text="Cancel" />
              </Button>
              <Button 
                onClick={applyNotificationSettings}
                disabled={notificationTimes.length === 0}
              >
                <TranslatableText text="Save Settings" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Debug Dialog */}
        <Dialog
          open={showNotificationDebug}
          onOpenChange={setShowNotificationDebug}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>
                <TranslatableText text="Notification Debug Information" />
              </DialogTitle>
              <DialogDescription>
                <TranslatableText text="Technical details about notification system status" />
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-4 py-2">
                {notificationDebugInfo && (
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Platform Information</h4>
                      <div className="bg-muted p-3 rounded-md text-xs space-y-1">
                        <div>Platform: {notificationDebugInfo.platform}</div>
                        <div>Native Context: {notificationDebugInfo.isNative ? 'Yes' : 'No'}</div>
                        <div>Timestamp: {new Date(notificationDebugInfo.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                    
                    {notificationDebugInfo.nativeStatus && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Native Plugin Status</h4>
                        <div className="bg-muted p-3 rounded-md text-xs">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(notificationDebugInfo.nativeStatus, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                    
                    {notificationDebugInfo.webStatus && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Web Status</h4>
                        <div className="bg-muted p-3 rounded-md text-xs">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(notificationDebugInfo.webStatus, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                    
                    {notificationDebugInfo.pluginErrors && notificationDebugInfo.pluginErrors.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Plugin Errors</h4>
                        <div className="bg-red-50 p-3 rounded-md text-xs space-y-2">
                          {notificationDebugInfo.pluginErrors.map((error: any, index: number) => (
                            <div key={index} className="border-l-2 border-red-200 pl-2">
                              <div className="font-medium">{error.plugin}</div>
                              <div className="text-red-600">{error.error}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowNotificationDebug(false)}
              >
                <TranslatableText text="Close" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        <Dialog
          open={showColorPicker}
          onOpenChange={(open) => {
            if (!open) setShowColorPicker(false);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                <TranslatableText text="Custom Color" />
              </DialogTitle>
              <DialogDescription>
                <TranslatableText text="Choose your own theme color" />
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <ColorPicker 
                value={colorPickerValue} 
                onChange={setColorPickerValue}
                applyImmediately={true}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowColorPicker(false)}
              >
                <TranslatableText text="Cancel" />
              </Button>
              <Button 
                onClick={applyCustomColor}
                style={{ backgroundColor: colorPickerValue }}
                className="text-white"
              >
                <TranslatableText text="Apply Color" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsLoadingWrapper>
  );
}

export default function Settings() {
  console.log('[Settings] Main Settings component rendering');
  
  const handleErrorBoundaryReset = () => {
    console.log('[Settings] Error boundary reset triggered');
    window.location.reload();
  };

  return (
    <SettingsErrorBoundary onReset={handleErrorBoundaryReset}>
      <SettingsContent />
    </SettingsErrorBoundary>
  );
}
