import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Lock, Moon, Sun, Palette, HelpCircle, Shield, Mail, Check as CheckIcon, LogOut, Monitor, Pencil, Save, X, Clock, Calendar } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/use-theme';
import { setupJournalReminder, initializeCapacitorNotifications, NotificationFrequency, NotificationTime } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import SouloLogo from '@/components/SouloLogo';
import { ColorPicker } from '@/components/settings/ColorPicker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { startOfDay, subDays, isWithinInterval } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

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
          <h3 className="font-medium text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function Settings() {
  const { theme, setTheme, colorTheme, setColorTheme, customColor, setCustomColor, systemTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationFrequency, setNotificationFrequency] = useState<NotificationFrequency>('once');
  const [notificationTimes, setNotificationTimes] = useState<NotificationTime[]>(['evening']);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const { user, signOut } = useAuth();
  const [maxStreak, setMaxStreak] = useState(0);
  const { entries } = useJournalEntries(user?.id, 0, !!user);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const [showFAQ, setShowFAQ] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerValue, setColorPickerValue] = useState(customColor);
  
  const [displayName, setDisplayName] = useState<string>('');
  const [originalDisplayName, setOriginalDisplayName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  
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

  const frequencyOptions: { label: string; value: NotificationFrequency }[] = [
    { label: 'Once a day', value: 'once' },
    { label: 'Twice a day', value: 'twice' },
    { label: 'Three times a day', value: 'thrice' },
  ];

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled = localStorage.getItem('notification_enabled') === 'true';
      const frequency = localStorage.getItem('notification_frequency') as NotificationFrequency;
      const times = localStorage.getItem('notification_times');
      
      if (enabled) {
        setNotificationsEnabled(true);
      }
      
      if (frequency && ['once', 'twice', 'thrice'].includes(frequency)) {
        setNotificationFrequency(frequency);
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
    }
  }, []);

  useEffect(() => {
    if (notificationsEnabled) {
      setupJournalReminder(true, notificationFrequency, notificationTimes).then(() => {
        if (typeof window !== 'undefined' && !('Notification' in window) || 
            (window.Notification && window.Notification.permission !== 'granted')) {
          initializeCapacitorNotifications();
        }
      });
    }
  }, [notificationsEnabled, notificationFrequency, notificationTimes]);

  const handleContactSupport = () => {
    const subject = encodeURIComponent("Help me, I don't want to be SOuLO right now");
    const mailtoLink = `mailto:verma.yashaswi@gmail.com?subject=${subject}`;
    window.open(mailtoLink, '_blank');
  };
  
  const handleLogout = async () => {
    try {
      toast.info('Logging out...');
      await signOut();
    } catch (error) {
      console.error('Error logging out from Settings page:', error);
      window.location.href = '/';
    }
  };

  const applyCustomColor = () => {
    setCustomColor(colorPickerValue);
    setColorTheme('Custom');
    toast.success('Custom color applied');
    setShowColorPicker(false);
  };

  const saveDisplayName = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          display_name: displayName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) {
        toast.error('Failed to update display name');
        console.error(error);
        return;
      }
      
      setOriginalDisplayName(displayName.trim());
      toast.success('Display name updated successfully');
      setIsEditingName(false);
    } catch (error) {
      console.error('Error updating display name', error);
      toast.error('Something went wrong');
    }
  };

  const cancelNameEdit = () => {
    setDisplayName(originalDisplayName);
    setIsEditingName(false);
  };
  
  const handleToggleNotifications = (checked: boolean) => {
    setNotificationsEnabled(checked);
    
    if (checked) {
      setShowNotificationSettings(true);
      toast.success("Customize your notification settings");
    } else {
      toast.info("Notifications disabled");
      // Clear notification settings from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('notification_enabled');
        localStorage.removeItem('notification_frequency');
        localStorage.removeItem('notification_times');
      }
    }
  };
  
  const handleTimeChange = (time: NotificationTime) => {
    setNotificationTimes(prev => {
      // If already selected, remove it (toggle behavior)
      if (prev.includes(time)) {
        return prev.filter(t => t !== time);
      }
      // Otherwise add it
      return [...prev, time];
    });
  };
  
  const applyNotificationSettings = () => {
    // Ensure we have at least one time selected
    if (notificationTimes.length === 0) {
      toast.error("Please select at least one time for notifications");
      return;
    }
    
    // Make sure we don't have more time slots than frequency allows
    let limitedTimes = [...notificationTimes];
    const maxTimes = notificationFrequency === 'once' ? 1 : 
                    notificationFrequency === 'twice' ? 2 : 3;
    
    if (limitedTimes.length > maxTimes) {
      limitedTimes = limitedTimes.slice(0, maxTimes);
      setNotificationTimes(limitedTimes);
      toast.info(`Limited to ${maxTimes} time${maxTimes > 1 ? 's' : ''} based on frequency`);
    }
    
    // Apply settings
    setupJournalReminder(true, notificationFrequency, limitedTimes);
    toast.success("Notification settings saved");
    setShowNotificationSettings(false);
  };
  
  const getNotificationSummary = () => {
    if (!notificationsEnabled) return "Disabled";
    
    const frequencyText = {
      'once': 'Once',
      'twice': 'Twice',
      'thrice': 'Three times'
    }[notificationFrequency];
    
    const timeLabels = notificationTimes.map(time => {
      return {
        'morning': 'Morning',
        'afternoon': 'Afternoon',
        'evening': 'Evening',
        'night': 'Night'
      }[time];
    });
    
    return `${frequencyText} daily: ${timeLabels.join(', ')}`;
  };

  return (
    <div className="min-h-screen pb-20">
      <Navbar />
      
      <div className={cn("max-w-3xl mx-auto px-4", isMobile ? "pt-0" : "pt-2")}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 text-theme-color">Settings</h1>
          <p className="text-muted-foreground">Personalize your SOuLO experience</p>
        </div>
        
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-background rounded-xl p-6 shadow-sm border"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-theme-color">Your Profile</h2>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
              <div className="flex flex-col items-center">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback>
                    {user?.email?.substring(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
              
              <div className="flex-1 space-y-4 text-center sm:text-left">
                <div>
                  {isEditingName ? (
                    <div className="flex flex-col space-y-2">
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter your display name"
                        className="max-w-xs"
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={cancelNameEdit}
                          className="flex items-center gap-1"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={saveDisplayName}
                          className="flex items-center gap-1 bg-theme hover:bg-theme/90"
                          disabled={!displayName.trim() || displayName.trim() === originalDisplayName}
                        >
                          <Save className="h-3 w-3" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <h3 className="text-xl font-semibold text-foreground">
                        {isLoadingProfile ? "Loading..." : 
                         originalDisplayName || user?.user_metadata?.full_name || 'User'}
                      </h3>
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
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-muted-foreground text-sm">Journal Entries</p>
                    <p className="text-xl font-medium text-foreground">{entries.length}</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-muted-foreground text-sm">Max Streak</p>
                    <p className="text-xl font-medium text-foreground">{maxStreak} days</p>
                  </div>
                </div>
                
                <Button 
                  variant="destructive" 
                  className="gap-2" 
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-background rounded-xl p-6 shadow-sm border"
          >
            <h2 className="text-xl font-semibold mb-4 text-theme-color">Appearance</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-foreground">Theme Mode</label>
                <div className="flex p-1 bg-secondary rounded-full w-fit">
                  <button
                    onClick={() => {
                      setTheme('light');
                      toast.success('Light theme applied');
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all",
                      theme === 'light' ? "bg-background shadow-sm" : "hover:text-foreground text-muted-foreground"
                    )}
                  >
                    <Sun className="h-4 w-4" />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => {
                      setTheme('dark');
                      toast.success('Dark theme applied');
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all",
                      theme === 'dark' ? "bg-background shadow-sm" : "hover:text-foreground text-muted-foreground"
                    )}
                  >
                    <Moon className="h-4 w-4" />
                    <span>Dark</span>
                  </button>
                  <button
                    onClick={() => {
                      setTheme('system');
                      toast.success('System theme applied');
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all",
                      theme === 'system' ? "bg-background shadow-sm" : "hover:text-foreground text-muted-foreground"
                    )}
                  >
                    <Monitor className="h-4 w-4 mr-1" />
                    <span>System {theme === 'system' && `(${systemTheme})`}</span>
                  </button>
                </div>
                {theme === 'system' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Using your device's {systemTheme} theme preference
                  </p>
                )}
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block text-theme-color">Color Theme</label>
                <div className="flex flex-wrap gap-3">
                  {colorThemes.map((themeOption) => (
                    <button
                      key={themeOption.name}
                      onClick={() => {
                        setColorTheme(themeOption.name as any);
                        toast.success(`${themeOption.name} theme applied`);
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
                        {themeOption.name}
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
                    Customize Your Color
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-background rounded-xl p-6 shadow-sm border"
          >
            <h2 className="text-xl font-semibold mb-4 text-theme-color">Preferences</h2>
            
            <div className="space-y-3 divide-y">
              <SettingItem
                icon={Bell}
                title="Notifications"
                description={notificationsEnabled ? getNotificationSummary() : "Get reminders to journal and stay on track"}
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
                      Customize
                    </Button>
                  )}
                </div>
              </SettingItem>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="bg-background rounded-xl p-6 shadow-sm border"
          >
            <h2 className="text-xl font-semibold mb-4 text-theme-color">Help & Support</h2>
            
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
                    <span className="font-medium text-foreground">FAQ</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Frequently asked questions</p>
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
                    <span className="font-medium text-foreground">Privacy Policy</span>
                  </div>
                  <p className="text-xs text-muted-foreground">How we protect your data</p>
                </div>
              </Button>
            </div>
            
            <div className="mt-6 text-center">
              <Button 
                variant="default" 
                className="gap-2 bg-theme-color hover:bg-theme-color/90" 
                onClick={handleContactSupport}
              >
                <Mail className="h-4 w-4" />
                Contact Support
              </Button>
            </div>
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
            <DialogTitle className="text-xl text-theme-color">Frequently Asked Questions</DialogTitle>
            <DialogDescription>
              Find answers to common questions about SOuLO
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6 py-2">
              <div className="space-y-2">
                <h3 className="text-base font-semibold">What is SOuLO?</h3>
                <p className="text-sm text-muted-foreground">
                  SOuLO is an AI-powered journaling app designed to help you track, analyze, and understand your emotions through voice recordings and text entries. Our app creates a safe space for self-reflection and personal growth.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">How do I create a journal entry?</h3>
                <p className="text-sm text-muted-foreground">
                  You can create a journal entry by navigating to the Journal tab and clicking on the "+" button. You can either type your entry or use the voice recording feature, which will automatically transcribe and analyze your spoken thoughts.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Is my data private?</h3>
                <p className="text-sm text-muted-foreground">
                  Yes, your privacy is our top priority. All journal entries are encrypted and only accessible to you. We do not share or sell your personal data with third parties. See our Privacy Policy for more details.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">How does the emotion analysis work?</h3>
                <p className="text-sm text-muted-foreground">
                  Our AI technology analyzes the text and tone of your journal entries to identify emotions and themes. It recognizes patterns in your writing or speech to provide insights about your emotional state and recurring topics.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Can I chat with my journal?</h3>
                <p className="text-sm text-muted-foreground">
                  Yes! One of SOuLO's unique features is the ability to chat with your journal. You can ask questions about your mood patterns, seek insights about your emotional trends, or get personalized reflections based on your journal entries.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">What is a journal streak?</h3>
                <p className="text-sm text-muted-foreground">
                  A journal streak represents the number of consecutive days you've created at least one journal entry. It's a way to track your consistency and build a regular journaling habit.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">How do I set up daily reminders?</h3>
                <p className="text-sm text-muted-foreground">
                  You can enable daily reminders by toggling on the Notifications option in the Settings page. You'll need to grant notification permissions to the app for this feature to work.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">How do I customize the app's appearance?</h3>
                <p className="text-sm text-muted-foreground">
                  In the Settings page, you can switch between light and dark mode, and choose from several color themes. You can even create your own custom color theme to personalize your experience.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">How do I view my emotional insights?</h3>
                <p className="text-sm text-muted-foreground">
                  Navigate to the Insights tab to see visualizations of your emotional patterns over time. You can view your mood calendar, emotion distribution, and recurring themes from your journal entries.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Is SOuLO available on all devices?</h3>
                <p className="text-sm text-muted-foreground">
                  SOuLO is available as a web application that works on all modern browsers. The responsive design ensures a great experience on both desktop and mobile devices.
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
            <DialogTitle className="text-xl text-theme-color">Privacy Policy</DialogTitle>
            <DialogDescription>
              How we protect your data and respect your privacy
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6 py-2">
              <p className="text-sm text-muted-foreground">Last Updated: April 8, 2025</p>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Introduction</h3>
                <p className="text-sm text-muted-foreground">
                  Welcome to SOuLO ("we," "our," or "us"). We are committed to protecting your privacy and handling your data with transparency and care. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our journaling application.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Information We Collect</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>Account Information:</strong> When you create an account, we collect your email address, name, and password.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Journal Entries:</strong> We store the content of your journal entries, including text and voice recordings.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Usage Data:</strong> We collect information about how you interact with our application, such as features used, time spent, and actions taken.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Device Information:</strong> We collect information about your device, including IP address, browser type, and operating system.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">How We Use Your Information</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>Provide and Improve Services:</strong> We use your information to deliver our journaling features, analyze your entries, and generate insights.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Personalization:</strong> We personalize your experience based on your preferences and usage patterns.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Communication:</strong> We may send you notifications, updates, and support messages.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Research and Development:</strong> We use anonymized data to improve our AI algorithms and develop new features.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Data Security</h3>
                <p className="text-sm text-muted-foreground">
                  We implement appropriate technical measures to protect your personal information.
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <Dialog
        open={showNotificationSettings}
        onOpenChange={(open) => {
          setShowNotificationSettings(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notification Settings</DialogTitle>
            <DialogDescription>
              Customize when you want to receive journal reminders
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Frequency</h3>
              <RadioGroup 
                value={notificationFrequency} 
                onValueChange={(value) => setNotificationFrequency(value as NotificationFrequency)}
                className="flex flex-col space-y-2"
              >
                {frequencyOptions.map(option => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={`frequency-${option.value}`} />
                    <Label htmlFor={`frequency-${option.value}`} className="cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-sm">Time of Day</h3>
                <p className="text-xs text-muted-foreground">
                  {notificationFrequency === 'once' ? 'Select 1 time' : 
                   notificationFrequency === 'twice' ? 'Select up to 2 times' : 
                   'Select up to 3 times'}
                </p>
              </div>
              
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
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowNotificationSettings(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={applyNotificationSettings}
              disabled={notificationTimes.length === 0}
            >
              Apply Settings
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
            <DialogTitle>Custom Color</DialogTitle>
            <DialogDescription>
              Choose your own theme color
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ColorPicker 
              value={colorPickerValue} 
              onChange={setColorPickerValue} 
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowColorPicker(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={applyCustomColor}
              style={{ backgroundColor: colorPickerValue }}
              className="text-white"
            >
              Apply Color
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
