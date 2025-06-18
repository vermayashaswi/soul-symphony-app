
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Moon, Sun, Palette, User, Bell, Shield, HelpCircle, LogOut, Trash2, Download, Upload } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { ColorPicker } from '@/components/settings/ColorPicker';
import { useTranslation } from '@/contexts/TranslationContext';
import { TranslatableText } from '@/components/translation/TranslatableText';
import LanguageSelector from '@/components/translation/LanguageSelector';
import { SubscriptionManagement } from '@/components/settings/SubscriptionManagement';
import { DeleteAllEntriesSection } from '@/components/settings/DeleteAllEntriesSection';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { SettingsLoadingWrapper } from '@/components/settings/SettingsLoadingWrapper';
import { Link } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';

const Settings = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [dataAnalytics, setDataAnalytics] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [accentColor, setAccentColor] = useState('#3b82f6');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
    
  const { translate } = useTranslation();

  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const updateProfile = async () => {
    setUpdating(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          name: name,
        },
      });

      if (error) {
        console.error('Error updating profile:', error);
        toast({
          title: await translate('Error'),
          description: await translate('Failed to update profile'),
          variant: 'destructive',
        });
      } else {
        console.log('Profile updated successfully:', data);
        toast({
          title: await translate('Success'),
          description: await translate('Profile updated successfully'),
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: await translate('Error'),
        description: await translate('Failed to update profile'),
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleColorChange = (color: string) => {
    setAccentColor(color);
    // Apply the color to CSS custom properties or your theme system
    document.documentElement.style.setProperty('--accent-color', color);
  };

  return (
    <SettingsLoadingWrapper isLoading={isLoading}>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">
              <TranslatableText text="Settings" />
            </h1>
            <p className="text-muted-foreground mt-2">
              <TranslatableText text="Manage your account and app preferences" />
            </p>
          </div>

          <div className="space-y-6">
            {/* Profile Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <TranslatableText text="Profile" />
                </CardTitle>
                <CardDescription>
                  <TranslatableText text="Update your personal information" />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ProfilePictureUpload />
                
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      <TranslatableText text="Display Name" />
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      <TranslatableText text="Email" />
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-sm text-muted-foreground">
                      <TranslatableText text="Email cannot be changed" />
                    </p>
                  </div>

                  <Button onClick={updateProfile} disabled={updating} className="w-fit">
                    {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <TranslatableText text="Update Profile" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* App Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  <TranslatableText text="Appearance" />
                </CardTitle>
                <CardDescription>
                  <TranslatableText text="Customize how the app looks and feels" />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">
                      <TranslatableText text="Theme" />
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      <TranslatableText text="Choose your preferred theme" />
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Sun className="h-4 w-4" />
                    <Switch
                      checked={theme === 'dark'}
                      onCheckedChange={toggleTheme}
                    />
                    <Moon className="h-4 w-4" />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base">
                    <TranslatableText text="Accent Color" />
                  </Label>
                  <ColorPicker 
                    value={accentColor}
                    onChange={handleColorChange}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-base">
                    <TranslatableText text="Language" />
                  </Label>
                  <LanguageSelector />
                </div>
              </CardContent>
            </Card>

            {/* Subscription Management */}
            <SubscriptionManagement />

            {/* Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  <TranslatableText text="Notifications" />
                </CardTitle>
                <CardDescription>
                  <TranslatableText text="Manage your notification preferences" />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">
                      <TranslatableText text="Push Notifications" />
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      <TranslatableText text="Receive notifications about your journal insights" />
                    </p>
                  </div>
                  <Switch
                    checked={notifications}
                    onCheckedChange={setNotifications}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Privacy & Security */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  <TranslatableText text="Privacy & Security" />
                </CardTitle>
                <CardDescription>
                  <TranslatableText text="Manage your privacy settings and data" />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">
                      <TranslatableText text="Data Analytics" />
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      <TranslatableText text="Help improve the app by sharing anonymous usage data" />
                    </p>
                  </div>
                  <Switch
                    checked={dataAnalytics}
                    onCheckedChange={setDataAnalytics}
                  />
                </div>

                <div className="pt-4 border-t">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <TranslatableText text="View Privacy Policy" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>
                          <TranslatableText text="Privacy Policy" />
                        </DialogTitle>
                        <DialogDescription>
                          <TranslatableText text="Last Updated: April 10, 2024" />
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="mt-4 h-[60vh] pr-4">
                        <div className="space-y-4 text-sm">
                          <p>
                            <TranslatableText text="SOULo ('we', 'our', or 'us') is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our SOULo application and related services (collectively, the 'Service')." />
                          </p>
                          
                          <div>
                            <h3 className="font-semibold mb-2">
                              <TranslatableText text="Data Collection" />
                            </h3>
                            <p className="mb-2">
                              <TranslatableText text="We collect the following information:" />
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li><TranslatableText text="Account information including email and name" /></li>
                              <li><TranslatableText text="Voice recordings and their transcriptions" /></li>
                              <li><TranslatableText text="Usage data and app interactions" /></li>
                              <li><TranslatableText text="Device information" /></li>
                            </ul>
                          </div>

                          <div>
                            <h3 className="font-semibold mb-2">
                              <TranslatableText text="How We Use Your Information" />
                            </h3>
                            <ul className="list-disc pl-5 space-y-1">
                              <li><TranslatableText text="To provide and maintain our Service" /></li>
                              <li><TranslatableText text="To personalize your experience" /></li>
                              <li><TranslatableText text="To communicate with you about your account" /></li>
                              <li><TranslatableText text="To improve our Service" /></li>
                            </ul>
                          </div>

                          <div>
                            <h3 className="font-semibold mb-2">
                              <TranslatableText text="Journal Privacy" />
                            </h3>
                            <p className="mb-2">
                              <strong><TranslatableText text="Your journal entries are private" /></strong>
                              <TranslatableText text=" and we take extensive measures to protect them." />
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                              <li><TranslatableText text="Entries are encrypted in transit and at rest" /></li>
                              <li><TranslatableText text="Only you can access your journal content" /></li>
                              <li><TranslatableText text="We do not share your journal entries with third parties" /></li>
                            </ul>
                          </div>

                          <div>
                            <h3 className="font-semibold mb-2">
                              <TranslatableText text="Your Rights" />
                            </h3>
                            <ul className="list-disc pl-5 space-y-1">
                              <li><TranslatableText text="Right to access your data" /></li>
                              <li><TranslatableText text="Right to correct inaccurate data" /></li>
                              <li><TranslatableText text="Right to delete your data" /></li>
                              <li><TranslatableText text="Right to restrict processing" /></li>
                            </ul>
                          </div>

                          <div>
                            <h3 className="font-semibold mb-2">
                              <TranslatableText text="Contact Us" />
                            </h3>
                            <p>
                              <TranslatableText text="If you have any questions about this Privacy Policy, please contact us:" />
                            </p>
                            <p className="mt-1">
                              <a 
                                href="mailto:support@soulo.online"
                                className="text-blue-600 hover:underline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  window.open('mailto:support@soulo.online', '_blank');
                                }}
                              >
                                support@soulo.online
                              </a>
                            </p>
                          </div>

                          <div className="pt-4 border-t">
                            <p className="text-xs text-muted-foreground">
                              <TranslatableText text="For the complete Privacy Policy, please visit:" />
                            </p>
                            <a 
                              href="https://soulo.online/privacy"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs"
                              onClick={() => {
                                window.open('https://soulo.online/privacy', '_blank');
                              }}
                            >
                              https://soulo.online/privacy
                            </a>
                          </div>
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            {/* Data Management */}
            <DeleteAllEntriesSection />

            {/* Help & Support */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  <TranslatableText text="Help & Support" />
                </CardTitle>
                <CardDescription>
                  <TranslatableText text="Get help and contact support" />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/faq">
                    <TranslatableText text="Frequently Asked Questions" />
                  </Link>
                </Button>
                
                <Button variant="outline" className="w-full" asChild>
                  <a href="mailto:support@soulo.online">
                    <TranslatableText text="Contact Support" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Account Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <LogOut className="h-5 w-5" />
                  <TranslatableText text="Account Actions" />
                </CardTitle>
                <CardDescription>
                  <TranslatableText text="Manage your account" />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive" 
                  onClick={signOut}
                  className="w-full"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <TranslatableText text="Sign Out" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SettingsLoadingWrapper>
  );
};

export default Settings;
