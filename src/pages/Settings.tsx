
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Bell, User, Palette, Globe, Crown, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/integrations/supabase/client';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { ColorPicker } from '@/components/settings/ColorPicker';
import { LanguageSelector } from '@/components/translation/LanguageSelector';
import { SubscriptionManagementModal } from '@/components/premium/SubscriptionManagementModal';
import { PremiumBadge } from '@/components/premium/PremiumBadge';
import { useSubscription } from '@/hooks/use-subscription';

const Settings = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { hasActiveTrialOrSubscription } = useSubscription();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [accentColor, setAccentColor] = useState('#3b82f6');

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }

      setProfile(data);
      // Handle accent_color safely since it might not exist in the database
      if (data && typeof data === 'object' && 'accent_color' in data && data.accent_color) {
        setAccentColor(data.accent_color as string);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: any) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...updates });

      if (error) throw error;

      setProfile({ ...profile, ...updates });
      toast({
        title: "Settings updated",
        description: "Your preferences have been saved.",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReminderChange = (type: 'morning' | 'evening', enabled: boolean) => {
    const currentSettings = profile?.reminder_settings || { morning: true, evening: true };
    const newSettings = { ...currentSettings, [type]: enabled };
    updateProfile({ reminder_settings: newSettings });
  };

  const handleColorChange = (hexColor: string) => {
    setAccentColor(hexColor);
    updateProfile({ accent_color: hexColor });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Settings</h1>
          <PremiumBadge />
        </div>

        {/* Subscription Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-600" />
              Subscription
            </CardTitle>
            <CardDescription>
              Manage your Soulo Premium subscription and billing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {hasActiveTrialOrSubscription 
                    ? "You have access to all premium features"
                    : "Upgrade to unlock premium features"}
                </p>
              </div>
              <Button 
                onClick={() => setShowSubscriptionModal(true)}
                variant={hasActiveTrialOrSubscription ? "outline" : "default"}
              >
                {hasActiveTrialOrSubscription ? "Manage Subscription" : "Upgrade to Premium"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>
              Manage your profile information and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ProfilePictureUpload />
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how the app looks and feels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred theme
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('light')}
                >
                  <Sun className="h-4 w-4" />
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                >
                  <Moon className="h-4 w-4" />
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('system')}
                >
                  Auto
                </Button>
              </div>
            </div>

            <Separator />

            <ColorPicker 
              value={accentColor}
              onChange={handleColorChange}
            />
          </CardContent>
        </Card>

        {/* Language & Region */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Language & Region
            </CardTitle>
            <CardDescription>
              Set your language preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Language</Label>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred language
                </p>
              </div>
              <LanguageSelector />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure when you'd like to receive reminders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Morning Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Get reminded to reflect in the morning
                </p>
              </div>
              <Switch
                checked={profile?.reminder_settings?.morning ?? true}
                onCheckedChange={(checked) => handleReminderChange('morning', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Evening Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Get reminded to journal in the evening
                </p>
              </div>
              <Switch
                checked={profile?.reminder_settings?.evening ?? true}
                onCheckedChange={(checked) => handleReminderChange('evening', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Manage your account settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleSignOut}
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>

      <SubscriptionManagementModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />
    </div>
  );
};

export default Settings;
