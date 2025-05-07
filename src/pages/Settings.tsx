
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/contexts/TranslationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { ColorPicker } from '@/components/settings/ColorPicker';
import RestartTutorialButton from '@/components/tutorial/RestartTutorialButton';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Bell, LogOut, Shield, Mail, HelpCircle, ChevronRight } from 'lucide-react';
import NotificationSettings from '@/components/settings/NotificationSettings';
import { useUserStats } from '@/hooks/use-user-stats';
import ThemeSelector from '@/components/settings/ThemeSelector';

const Settings = () => {
  const { user, signOut } = useAuth();
  const { setTheme, theme, colorTheme } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [initialName, setInitialName] = useState('');
  const { currentLanguage } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationSummary, setNotificationSummary] = useState('Twice daily: Evening');
  const { journalCount, maxStreak } = useUserStats();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        
        if (data?.display_name) {
          setDisplayName(data.display_name);
          setInitialName(data.display_name);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserProfile();

    // Fetch notification settings from localStorage
    const storedEnabled = localStorage.getItem('notification_enabled');
    if (storedEnabled !== null) {
      setNotificationsEnabled(storedEnabled === 'true');
    }
    
    const storedFreq = localStorage.getItem('notification_frequency');
    const storedTimes = localStorage.getItem('notification_times');
    if (storedFreq && storedTimes) {
      try {
        const times = JSON.parse(storedTimes);
        setNotificationSummary(`${storedFreq === 'once' ? 'Once' : storedFreq === 'twice' ? 'Twice' : 'Thrice'} daily: ${times.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}`);
      } catch (e) {
        console.error('Error parsing notification settings:', e);
      }
    }
  }, [user]);

  const handleUpdateDisplayName = async () => {
    if (!user || displayName === initialName) return;
    
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      toast.success('Display name updated successfully');
      setInitialName(displayName);
    } catch (error) {
      console.error('Error updating display name:', error);
      toast.error('Failed to update display name');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNotifications = () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    localStorage.setItem('notification_enabled', newValue.toString());
    toast.success(`Notifications ${newValue ? 'enabled' : 'disabled'}`);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Successfully signed out');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 pb-24">
      <h1 className="text-2xl font-bold mb-6">
        <TranslatableText text="Settings" />
      </h1>
      
      <div className="space-y-6">
        {/* Profile Section */}
        <section className="bg-card rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            <TranslatableText text="Your Profile" />
          </h2>
          
          <div className="flex items-center mb-6">
            <div className="flex-shrink-0">
              <ProfilePictureUpload />
            </div>
            <div className="ml-6 flex-1">
              <div className="space-y-4">
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium mb-1">
                    <TranslatableText text="Display Name" />
                  </label>
                  <div className="flex">
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleUpdateDisplayName}
                      disabled={isLoading || displayName === initialName}
                      className="ml-2"
                      size="sm"
                    >
                      <TranslatableText text="Save" />
                    </Button>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    <TranslatableText text="Email" />
                  </label>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card className="p-4 bg-background">
              <CardContent className="p-0 text-center">
                <p className="text-sm text-muted-foreground"><TranslatableText text="Journal Entries" /></p>
                <p className="text-3xl font-bold mt-1">{journalCount || 0}</p>
              </CardContent>
            </Card>
            <Card className="p-4 bg-background">
              <CardContent className="p-0 text-center">
                <p className="text-sm text-muted-foreground"><TranslatableText text="Max Streak" /></p>
                <p className="text-3xl font-bold mt-1">{maxStreak || 0}</p>
              </CardContent>
            </Card>
          </div>
        </section>
        
        {/* Appearance Section */}
        <section className="bg-card rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            <TranslatableText text="Appearance" />
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">
                <TranslatableText text="Theme Mode" />
              </label>
              <div className="flex gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme('light')}
                >
                  <TranslatableText text="Light" />
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme('dark')}
                >
                  <TranslatableText text="Dark" />
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme('system')}
                >
                  <TranslatableText text="System" />
                </Button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-3">
                <TranslatableText text="Color Theme" />
              </label>
              <ThemeSelector />
            </div>
            
            <div className="pt-2">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => document.getElementById('customizeColorBtn')?.click()}
              >
                <TranslatableText text="Customize Your Color" />
              </Button>
              {/* Hidden button to open the ColorPicker */}
              <Button 
                id="customizeColorBtn"
                className="hidden"
                onClick={() => {
                  // This functionality will be implemented when needed
                }}
              >
                Custom
              </Button>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                <TranslatableText text="Tutorial" />
              </label>
              <RestartTutorialButton />
            </div>
          </div>
        </section>
        
        {/* Preferences Section */}
        <section className="bg-card rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            <TranslatableText text="Preferences" />
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bell className="mr-3 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium"><TranslatableText text="Notifications" /></p>
                  <p className="text-sm text-muted-foreground">{notificationSummary}</p>
                </div>
              </div>
              <Switch 
                checked={notificationsEnabled} 
                onCheckedChange={toggleNotifications} 
              />
            </div>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowNotificationSettings(true)}
            >
              <TranslatableText text="Customize" />
            </Button>
          </div>
        </section>
        
        {/* Help & Support Section */}
        <section className="bg-card rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            <TranslatableText text="Help & Support" />
          </h2>
          
          <div className="space-y-2">
            <button 
              className="flex items-center justify-between w-full p-3 hover:bg-muted rounded-md transition-colors"
              onClick={() => setShowFAQ(true)}
            >
              <div className="flex items-center">
                <HelpCircle className="mr-3 h-5 w-5 text-muted-foreground" />
                <span><TranslatableText text="FAQ" /></span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            
            <button 
              className="flex items-center justify-between w-full p-3 hover:bg-muted rounded-md transition-colors"
              onClick={() => setShowPrivacyPolicy(true)}
            >
              <div className="flex items-center">
                <Shield className="mr-3 h-5 w-5 text-muted-foreground" />
                <span><TranslatableText text="Privacy Policy" /></span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            
            <Button 
              variant="outline" 
              className="w-full mt-2 flex items-center"
              onClick={() => window.location.href = 'mailto:support@soulo.online'}
            >
              <Mail className="mr-2 h-4 w-4" />
              <TranslatableText text="Contact Support" />
            </Button>
          </div>
        </section>
        
        {/* Account Section */}
        <section className="bg-card rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            <TranslatableText text="Account" />
          </h2>
          
          <Button 
            variant="destructive" 
            onClick={handleSignOut}
            className="w-full flex items-center justify-center"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <TranslatableText text="Sign Out" />
          </Button>
        </section>
      </div>
      
      {/* Notification Settings Dialog */}
      <Dialog open={showNotificationSettings} onOpenChange={setShowNotificationSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle><TranslatableText text="Notification Settings" /></DialogTitle>
            <DialogDescription>
              <TranslatableText text="Customize how and when you receive notifications" />
            </DialogDescription>
          </DialogHeader>
          <NotificationSettings 
            onSave={() => {
              setShowNotificationSettings(false);
              // Update notification summary after saving
              const storedFreq = localStorage.getItem('notification_frequency');
              const storedTimes = localStorage.getItem('notification_times');
              if (storedFreq && storedTimes) {
                try {
                  const times = JSON.parse(storedTimes);
                  setNotificationSummary(`${storedFreq === 'once' ? 'Once' : storedFreq === 'twice' ? 'Twice' : 'Thrice'} daily: ${times.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}`);
                } catch (e) {
                  console.error('Error parsing notification settings:', e);
                }
              }
            }} 
          />
        </DialogContent>
      </Dialog>
      
      {/* Privacy Policy Dialog */}
      <Dialog open={showPrivacyPolicy} onOpenChange={setShowPrivacyPolicy}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle><TranslatableText text="Privacy Policy" /></DialogTitle>
          </DialogHeader>
          <div className="text-sm">
            <h3 className="font-semibold text-base mb-2">Introduction</h3>
            <p className="mb-4">We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we look after your personal data and tell you about your privacy rights.</p>
            
            <h3 className="font-semibold text-base mb-2">Data We Collect</h3>
            <p className="mb-4">We collect and process your email address, journal entries, and usage data to provide you with our services. This data is stored securely on our servers.</p>
            
            <h3 className="font-semibold text-base mb-2">How We Use Your Data</h3>
            <p className="mb-4">We use your data to provide and improve our services, analyze usage patterns, and personalize your experience. We don't sell your data to third parties.</p>
            
            <h3 className="font-semibold text-base mb-2">Your Rights</h3>
            <p className="mb-4">You have the right to access, correct, or delete your personal data at any time. You can also request a copy of all data we store about you.</p>
          </div>
          <DialogClose asChild>
            <Button className="mt-4">Close</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      
      {/* FAQ Dialog */}
      <Dialog open={showFAQ} onOpenChange={setShowFAQ}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle><TranslatableText text="Frequently Asked Questions" /></DialogTitle>
          </DialogHeader>
          <div className="text-sm">
            <div className="mb-4">
              <h3 className="font-semibold text-base mb-1">What is SoulO?</h3>
              <p>SoulO is an AI-powered journaling app designed to help you track your emotions, gain insights, and improve your mental wellbeing through regular reflection.</p>
            </div>
            
            <div className="mb-4">
              <h3 className="font-semibold text-base mb-1">How do I start journaling?</h3>
              <p>Simply tap on the + button on the home screen or go to the Journal tab and tap the record button to start speaking your thoughts.</p>
            </div>
            
            <div className="mb-4">
              <h3 className="font-semibold text-base mb-1">Is my data private?</h3>
              <p>Yes, your journal entries and personal information are encrypted and stored securely. We don't share your data with third parties.</p>
            </div>
            
            <div className="mb-4">
              <h3 className="font-semibold text-base mb-1">How does emotion tracking work?</h3>
              <p>Our AI analyzes the text of your journal entries to identify emotions, themes, and sentiment. This helps you see patterns in your emotional state over time.</p>
            </div>
            
            <div className="mb-4">
              <h3 className="font-semibold text-base mb-1">Can I export my journal data?</h3>
              <p>Yes, you can export all your journal entries through the settings menu. This feature will be available in an upcoming update.</p>
            </div>
          </div>
          <DialogClose asChild>
            <Button className="mt-4">Close</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
