import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Bell, 
  Palette, 
  Globe, 
  Download, 
  LogOut, 
  Shield,
  Moon,
  Sun,
  Smartphone,
  Crown
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from '@/contexts/TranslationContext';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { LanguageSelector } from '@/components/translation/LanguageSelector';
import { ColorPicker } from '@/components/settings/ColorPicker';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { useSubscription } from '@/contexts/SubscriptionContext';
import PremiumBadge from '@/components/subscription/PremiumBadge';
import SubscriptionManager from '@/components/subscription/SubscriptionManager';

interface ReminderSettings {
  morning: boolean;
  evening: boolean;
  morningTime: string;
  eveningTime: string;
}

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  display_name: string | null;
  reminder_settings: ReminderSettings;
}

// Type guard function to check if data is ReminderSettings
const isReminderSettings = (data: any): data is ReminderSettings => {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.morning === 'boolean' &&
    typeof data.evening === 'boolean' &&
    typeof data.morningTime === 'string' &&
    typeof data.eveningTime === 'string'
  );
};

const Settings: React.FC = () => {
  const { user, signOut } = useAuth();
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();
  const { currentLanguage } = useTranslation();
  const { isPremium } = useSubscription();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSubscriptionManager, setShowSubscriptionManager] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          toast.error('Failed to load profile. Please try again.');
        } else {
          // Handle the reminder_settings type properly with type guard
          const reminderSettings: ReminderSettings = isReminderSettings(data.reminder_settings)
            ? data.reminder_settings
            : {
                morning: false,
                evening: false,
                morningTime: '08:00',
                eveningTime: '20:00'
              };

          setProfile({
            id: data.id,
            email: user.email,
            full_name: data.full_name,
            avatar_url: data.avatar_url,
            display_name: data.display_name,
            reminder_settings: reminderSettings
          });
        }
      } catch (error) {
        console.error('Error in fetchProfile:', error);
        toast.error('An unexpected error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id, user?.email]);

  const updateReminderSettings = async (newSettings: ReminderSettings) => {
    if (!user?.id) return;

    try {
      // Convert ReminderSettings to a plain object for JSON storage
      const settingsForDb = {
        morning: newSettings.morning,
        evening: newSettings.evening,
        morningTime: newSettings.morningTime,
        eveningTime: newSettings.eveningTime
      };

      const { error } = await supabase
        .from('profiles')
        .update({ reminder_settings: settingsForDb })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating reminder settings:', error);
        toast.error('Failed to update reminder settings. Please try again.');
      } else {
        setProfile(prev => prev ? { ...prev, reminder_settings: newSettings } : null);
        toast.success('Reminder settings updated successfully.');
      }
    } catch (error) {
      console.error('Error in updateReminderSettings:', error);
      toast.error('An unexpected error occurred. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/app/auth');
    } catch (error) {
      console.error('Sign out failed:', error);
      toast.error('Failed to sign out. Please try again.');
    }
  };

  const handleUpgradeClick = () => {
    setShowSubscriptionManager(true);
  };

  const handleColorChange = (newColor: string) => {
    // setColorTheme expects a specific type, so we cast the string to that type
    setColorTheme(newColor as any);
    toast.success('Color theme updated successfully.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-theme border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (showSubscriptionManager) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button 
              variant="ghost" 
              onClick={() => setShowSubscriptionManager(false)}
              className="p-2"
            >
              ←
            </Button>
            <h1 className="text-2xl font-bold">
              <TranslatableText text="Subscription" forceTranslate={true} />
            </h1>
          </div>
          <SubscriptionManager />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-theme rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              <TranslatableText text="Settings" forceTranslate={true} />
            </h1>
            <p className="text-muted-foreground">
              <TranslatableText text="Manage your account and preferences" forceTranslate={true} />
            </p>
          </div>
        </div>

        {/* Premium Badge */}
        <PremiumBadge onUpgrade={handleUpgradeClick} className="mb-6" />

        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              <TranslatableText text="Profile" forceTranslate={true} />
            </CardTitle>
            <CardDescription>
              <TranslatableText text="Manage your personal information" forceTranslate={true} />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProfilePictureUpload 
              onUploadSuccess={(url) => {
                setProfile(prev => prev ? { ...prev, avatar_url: url } : null);
              }}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">
                  <TranslatableText text="Display Name" forceTranslate={true} />
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {profile?.display_name || profile?.full_name || 'Not set'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">
                  <TranslatableText text="Email" forceTranslate={true} />
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {profile?.email || 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              <TranslatableText text="Appearance" forceTranslate={true} />
            </CardTitle>
            <CardDescription>
              <TranslatableText text="Customize the look and feel of the app" forceTranslate={true} />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">
                  <TranslatableText text="Theme" forceTranslate={true} />
                </Label>
                <p className="text-xs text-muted-foreground">
                  <TranslatableText text="Choose your preferred theme" forceTranslate={true} />
                </p>
              </div>
              <div className="space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className={theme === 'light' ? 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground' : ''}
                  onClick={() => setTheme('light')}
                >
                  <Sun className="w-4 h-4 mr-2" />
                  <TranslatableText text="Light" forceTranslate={true} />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={theme === 'dark' ? 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground' : ''}
                  onClick={() => setTheme('dark')}
                >
                  <Moon className="w-4 h-4 mr-2" />
                  <TranslatableText text="Dark" forceTranslate={true} />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={theme === 'system' ? 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground' : ''}
                  onClick={() => setTheme('system')}
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  <TranslatableText text="System" forceTranslate={true} />
                </Button>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                <TranslatableText text="Color Theme" forceTranslate={true} />
              </Label>
              <ColorPicker 
                value={colorTheme || '#3b82f6'} 
                onChange={handleColorChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Language Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              <TranslatableText text="Language" forceTranslate={true} />
            </CardTitle>
            <CardDescription>
              <TranslatableText text="Set your preferred language" forceTranslate={true} />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSelector />
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <TranslatableText text="Notifications" forceTranslate={true} />
            </CardTitle>
            <CardDescription>
              <TranslatableText text="Manage your notification preferences" forceTranslate={true} />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="morning" className="text-sm font-medium">
                  <TranslatableText text="Morning Reminder" forceTranslate={true} />
                </Label>
                <p className="text-xs text-muted-foreground">
                  <TranslatableText text="Receive a daily reminder in the morning" forceTranslate={true} />
                </p>
              </div>
              <Switch 
                id="morning" 
                checked={profile?.reminder_settings?.morning || false}
                onCheckedChange={(checked) => {
                  updateReminderSettings({
                    ...profile?.reminder_settings,
                    morning: checked
                  } as ReminderSettings);
                }}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="evening" className="text-sm font-medium">
                  <TranslatableText text="Evening Reflection" forceTranslate={true} />
                </Label>
                <p className="text-xs text-muted-foreground">
                  <TranslatableText text="Reflect on your day in the evening" forceTranslate={true} />
                </p>
              </div>
              <Switch 
                id="evening"
                checked={profile?.reminder_settings?.evening || false}
                onCheckedChange={(checked) => {
                  updateReminderSettings({
                    ...profile?.reminder_settings,
                    evening: checked
                  } as ReminderSettings);
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <TranslatableText text="Privacy & Security" forceTranslate={true} />
            </CardTitle>
            <CardDescription>
              <TranslatableText text="Your data protection settings" forceTranslate={true} />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">
                  <TranslatableText text="Data Encryption" forceTranslate={true} />
                </Label>
                <p className="text-xs text-muted-foreground">
                  <TranslatableText text="All your data is encrypted at rest" forceTranslate={true} />
                </p>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                <TranslatableText text="Active" forceTranslate={true} />
              </Badge>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">
                  <TranslatableText text="Local Processing" forceTranslate={true} />
                </Label>
                <p className="text-xs text-muted-foreground">
                  <TranslatableText text="Voice processing happens on your device" forceTranslate={true} />
                </p>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                <TranslatableText text="Enabled" forceTranslate={true} />
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Account Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              <TranslatableText text="Account" forceTranslate={true} />
            </CardTitle>
            <CardDescription>
              <TranslatableText text="Manage your account settings" forceTranslate={true} />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleSignOut} className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              <TranslatableText text="Sign Out" forceTranslate={true} />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
