import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { LanguageSelector } from '@/components/translation/LanguageSelector';
import { useTranslation } from '@/contexts/TranslationContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Globe, 
  HelpCircle, 
  LogOut,
  Save,
  Mail,
  Phone,
  MapPin,
  Calendar,
  GraduationCap
} from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import ProfilePictureUpload from '@/components/settings/ProfilePictureUpload';
import ColorPicker from '@/components/settings/ColorPicker';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { translate, currentLanguage } = useTranslation();
  const { startTutorial } = useTutorial();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    date_of_birth: '',
    occupation: '',
    avatar_url: ''
  });
  
  const [notifications, setNotifications] = useState({
    email_notifications: false,
    push_notifications: false,
    weekly_summary: false
  });
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else {
      loadProfile();
    }
  }, [user, navigate]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        toast.error(await translate('Failed to load profile', 'en'));
      } else if (data) {
        setProfile({
          full_name: data.full_name || '',
          email: data.email || '',
          phone: data.phone || '',
          location: data.location || '',
          date_of_birth: data.date_of_birth || '',
          occupation: data.occupation || '',
          avatar_url: data.avatar_url || ''
        });
        
        setNotifications({
          email_notifications: data.email_notifications || false,
          push_notifications: data.push_notifications || false,
          weekly_summary: data.weekly_summary || false
        });
      }
    } catch (error) {
      console.error('Unexpected error loading profile:', error);
      toast.error(await translate('Unexpected error loading profile', 'en'));
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user?.id,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          location: profile.location,
          date_of_birth: profile.date_of_birth,
          occupation: profile.occupation,
          avatar_url: profile.avatar_url,
          email_notifications: notifications.email_notifications,
          push_notifications: notifications.push_notifications,
          weekly_summary: notifications.weekly_summary,
        }, { onConflict: 'id' });

      if (error) {
        console.error('Error updating profile:', error);
        toast.error(await translate('Failed to update profile', 'en'));
      } else {
        toast.success(await translate('Profile updated successfully', 'en'));
      }
    } catch (error) {
      console.error('Unexpected error updating profile:', error);
      toast.error(await translate('Unexpected error updating profile', 'en'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success(await translate('Logged out successfully', 'en'));
      navigate('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error(await translate('Failed to log out', 'en'));
    }
  };

  const handleRestartTutorial = () => {
    startTutorial();
    toast.success(await translate('Tutorial restarted!', 'en'));
  };

  return (
    <div className="min-h-screen pb-20 settings-container">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold mb-8">
            <TranslatableText text="Settings" />
          </h1>

          {/* Profile Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <TranslatableText text="Profile Information" />
              </CardTitle>
              <CardDescription>
                <TranslatableText text="Update your personal information and preferences." />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ProfilePictureUpload 
                currentAvatarUrl={profile.avatar_url}
                onAvatarUpdate={(url) => setProfile(prev => ({ ...prev, avatar_url: url }))}
              />
              
              <div className="space-y-2">
                <Label htmlFor="full_name"><TranslatableText text="Full Name" /></Label>
                <Input
                  id="full_name"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email"><TranslatableText text="Email" /></Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone"><TranslatableText text="Phone" /></Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location"><TranslatableText text="Location" /></Label>
                <Input
                  id="location"
                  value={profile.location}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_of_birth"><TranslatableText text="Date of Birth" /></Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={profile.date_of_birth}
                  onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="occupation"><TranslatableText text="Occupation" /></Label>
                <Input
                  id="occupation"
                  value={profile.occupation}
                  onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                />
              </div>
              
              <Button 
                onClick={saveProfile} 
                disabled={loading}
                className="whitespace-normal text-center leading-tight min-h-[2.5rem] h-auto py-2"
              >
                <Save className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="break-words">
                  {loading ? <TranslatableText text="Saving..." /> : <TranslatableText text="Save Changes" />}
                </span>
              </Button>
            </CardContent>
          </Card>

          {/* Notifications Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <TranslatableText text="Notifications" />
              </CardTitle>
              <CardDescription>
                <TranslatableText text="Manage your notification preferences." />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="email_notifications" className="w-2/3"><TranslatableText text="Email Notifications" /></Label>
                <Switch
                  id="email_notifications"
                  checked={notifications.email_notifications}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, email_notifications: checked })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label htmlFor="push_notifications" className="w-2/3"><TranslatableText text="Push Notifications" /></Label>
                <Switch
                  id="push_notifications"
                  checked={notifications.push_notifications}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, push_notifications: checked })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label htmlFor="weekly_summary" className="w-2/3"><TranslatableText text="Weekly Summary" /></Label>
                <Switch
                  id="weekly_summary"
                  checked={notifications.weekly_summary}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, weekly_summary: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                <TranslatableText text="Appearance" />
              </CardTitle>
              <CardDescription>
                <TranslatableText text="Customize the look and feel of your app." />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label><TranslatableText text="Theme" /></Label>
                <div className="flex gap-2">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('light')}
                    className="whitespace-normal text-center leading-tight min-h-[2rem] h-auto py-1.5"
                  >
                    <span className="break-words">
                      <TranslatableText text="Light" />
                    </span>
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                    className="whitespace-normal text-center leading-tight min-h-[2rem] h-auto py-1.5"
                  >
                    <span className="break-words">
                      <TranslatableText text="Dark" />
                    </span>
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('system')}
                    className="whitespace-normal text-center leading-tight min-h-[2rem] h-auto py-1.5"
                  >
                    <span className="break-words">
                      <TranslatableText text="System" />
                    </span>
                  </Button>
                </div>
              </div>
              
              <ColorPicker />
            </CardContent>
          </Card>

          {/* Language Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                <TranslatableText text="Language" />
              </CardTitle>
              <CardDescription>
                <TranslatableText text="Choose your preferred language." />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LanguageSelector />
            </CardContent>
          </Card>

          {/* Privacy & Security Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <TranslatableText text="Privacy & Security" />
              </CardTitle>
              <CardDescription>
                <TranslatableText text="Manage your privacy and security settings." />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Privacy settings will be added here in the future */}
            </CardContent>
          </Card>

          {/* Help & Support Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                <TranslatableText text="Help & Support" />
              </CardTitle>
              <CardDescription>
                <TranslatableText text="Get help and support for using the app." />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => window.open('mailto:support@soulo.online', '_blank')}
                  className="whitespace-normal text-center leading-tight min-h-[2.5rem] h-auto py-2 flex-1"
                >
                  <Mail className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="break-words">
                    <TranslatableText text="Contact Support" />
                  </span>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleRestartTutorial}
                  className="whitespace-normal text-center leading-tight min-h-[2.5rem] h-auto py-2 flex-1"
                >
                  <GraduationCap className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="break-words">
                    <TranslatableText text="Restart Tutorial" />
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Logout Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <LogOut className="h-5 w-5" />
                <TranslatableText text="Account Actions" />
              </CardTitle>
              <CardDescription>
                <TranslatableText text="Sign out of your account." />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                onClick={handleLogout}
                className="whitespace-normal text-center leading-tight min-h-[2.5rem] h-auto py-2"
              >
                <LogOut className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="break-words">
                  <TranslatableText text="Sign Out" />
                </span>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
