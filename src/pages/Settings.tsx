
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Settings as SettingsIcon, User, Palette, Download, Globe, Shield, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/use-theme';
import { ColorPicker } from '@/components/settings/ColorPicker';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/translation/LanguageSelector';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useIsMobile } from '@/hooks/use-mobile';
import { SubscriptionManagement } from '@/components/settings/SubscriptionManagement';
import { DeleteAllEntriesSection } from '@/components/settings/DeleteAllEntriesSection';
import { SettingsLoadingWrapper } from '@/components/settings/SettingsLoadingWrapper';
import { SubscriptionBadge } from '@/components/settings/SubscriptionBadge';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentTheme, changeTheme, themes } = useTheme();
  const { isMobile } = useIsMobile();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      await signOut();
      toast.success(t('settings.logout_success', 'Logged out successfully'));
      navigate('/app/auth');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error(t('settings.logout_error', 'Failed to log out'));
    } finally {
      setIsLoggingOut(false);
    }
  };

  const containerClass = isMobile 
    ? "settings-container min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4 webtonative-safe-top"
    : "min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-6";

  return (
    <SettingsLoadingWrapper>
      <div className={containerClass}>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <SettingsIcon className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">
                <TranslatableText text="Settings" />
              </h1>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              <TranslatableText text="Customize your Soulo experience and manage your account" />
            </p>
          </div>

          {/* Your Profile Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>
                  <TranslatableText text="Your Profile" />
                </CardTitle>
              </div>
              <CardDescription>
                <TranslatableText text="Manage your account information and subscription" />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Picture */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <ProfilePictureUpload />
                <div className="flex-1 space-y-1">
                  <p className="font-medium">{user?.email || t('settings.no_email', 'No email')}</p>
                  <div className="flex items-center gap-2">
                    <SubscriptionBadge />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Subscription Management */}
              <SubscriptionManagement />
              
              <Separator />
              
              {/* Logout Button */}
              <div className="flex justify-end">
                <Button 
                  variant="destructive" 
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {isLoggingOut ? (
                    <TranslatableText text="Logging out..." />
                  ) : (
                    <TranslatableText text="Logout" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Appearance Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle>
                  <TranslatableText text="Appearance" />
                </CardTitle>
              </div>
              <CardDescription>
                <TranslatableText text="Customize the look and feel of your app" />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-3">
                  <TranslatableText text="Color Theme" />
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {themes.map((theme) => (
                    <ColorPicker
                      key={theme.name}
                      theme={theme}
                      isSelected={currentTheme?.name === theme.name}
                      onSelect={changeTheme}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Language & Region Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <CardTitle>
                  <TranslatableText text="Language & Region" />
                </CardTitle>
              </div>
              <CardDescription>
                <TranslatableText text="Set your preferred language and regional settings" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">
                    <TranslatableText text="Display Language" />
                  </h3>
                  <LanguageSelector />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                <CardTitle>
                  <TranslatableText text="Notifications" />
                </CardTitle>
              </div>
              <CardDescription>
                <TranslatableText text="Manage your notification preferences" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationCenter />
            </CardContent>
          </Card>

          {/* Data Management Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>
                  <TranslatableText text="Data Management" />
                </CardTitle>
              </div>
              <CardDescription>
                <TranslatableText text="Manage your journal data and privacy settings" />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeleteAllEntriesSection />
            </CardContent>
          </Card>
        </div>
      </div>
    </SettingsLoadingWrapper>
  );
};

export default Settings;
