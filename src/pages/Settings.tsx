
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/contexts/TranslationContext';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, User, Bell, Globe, Palette, Shield, Database, Smartphone, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

const Settings = () => {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { currentLanguage, setLanguage, availableLanguages } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [notifications, setNotifications] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/app/auth');
    } catch (error) {
      toast({
        title: "Error signing out",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) throw error;
      
      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted",
      });
      
      await signOut();
      navigate('/app/auth');
    } catch (error) {
      toast({
        title: "Error deleting account",
        description: "Please try again or contact support",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="settings-container min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            <TranslatableText text="Settings" />
          </h1>
          <p className="text-muted-foreground">
            <TranslatableText text="Manage your account and app preferences" />
          </p>
        </div>

        <div className="space-y-6">
          {/* Account Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <TranslatableText text="Account" />
              </CardTitle>
              <CardDescription>
                <TranslatableText text="Your account information and settings" />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    <TranslatableText text="Email" />
                  </p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <Separator />
              <Button 
                variant="outline" 
                onClick={handleSignOut}
                className="w-full justify-start"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <TranslatableText text="Sign Out" />
              </Button>
            </CardContent>
          </Card>

          {/* Appearance Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                <TranslatableText text="Appearance" />
              </CardTitle>
              <CardDescription>
                <TranslatableText text="Customize how the app looks" />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="theme">
                    <TranslatableText text="Theme" />
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Choose your preferred theme" />
                  </p>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <TranslatableText text="Light" />
                    </SelectItem>
                    <SelectItem value="dark">
                      <TranslatableText text="Dark" />
                    </SelectItem>
                    <SelectItem value="system">
                      <TranslatableText text="System" />
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Language Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                <TranslatableText text="Language" />
              </CardTitle>
              <CardDescription>
                <TranslatableText text="Select your preferred language" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="language">
                    <TranslatableText text="App Language" />
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Choose your preferred language" />
                  </p>
                </div>
                <Select value={currentLanguage} onValueChange={setLanguage}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Section */}
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
                <div>
                  <Label htmlFor="notifications">
                    <TranslatableText text="Push Notifications" />
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Receive notifications for important updates" />
                  </p>
                </div>
                <Switch
                  id="notifications"
                  checked={notifications}
                  onCheckedChange={setNotifications}
                />
              </div>
            </CardContent>
          </Card>

          {/* Device Section */}
          {isMobile.isMobile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  <TranslatableText text="Device" />
                </CardTitle>
                <CardDescription>
                  <TranslatableText text="Mobile device settings" />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    <TranslatableText text="Safe Area Support" />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Automatic safe area detection is enabled for optimal mobile experience" />
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                <TranslatableText text="Danger Zone" />
              </CardTitle>
              <CardDescription>
                <TranslatableText text="Irreversible actions" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="w-full justify-start"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                <TranslatableText text={isDeleting ? "Deleting..." : "Delete Account"} />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
