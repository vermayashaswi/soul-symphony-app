
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { ColorPicker } from '@/components/settings/ColorPicker';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { LanguageSelector } from '@/components/translation/LanguageSelector';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useMobileNotifications } from '@/hooks/use-mobile-notifications';
import { useNotificationBridge } from '@/components/notifications/NotificationBridge';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTheme } from '@/hooks/use-theme';
import { Bell, BellOff, Smartphone, Globe, Palette, User, Shield, Vibrate } from 'lucide-react';
import { toast } from 'sonner';

const Settings: React.FC = () => {
  const { displayName: profileDisplayName, timezone, updateDisplayName, updateTimezone } = useUserProfile();
  const { theme, setTheme } = useTheme();
  const { 
    settings: notificationSettings, 
    hasPermission, 
    canRequestPermission,
    updateSettings,
    testNotification,
    enableNotifications,
    disableNotifications,
    isLoading: notificationLoading 
  } = useMobileNotifications();
  const { deviceInfo, permissionStatus } = useNotificationBridge();

  // Local state for form management
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [tempNotificationTimes, setTempNotificationTimes] = useState<string[]>(['evening']);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [accentColor, setAccentColor] = useState('#3b82f6');

  // Create a profile object for compatibility
  const profile = {
    display_name: profileDisplayName,
    bio: bio,
    avatar_url: null, // This would need to come from auth user metadata if available
    timezone: timezone
  };

  const profileLoading = false; // The useUserProfile hook doesn't expose loading state

  // Initialize form data
  useEffect(() => {
    if (profileDisplayName) {
      setDisplayName(profileDisplayName);
    }
  }, [profileDisplayName]);

  useEffect(() => {
    if (notificationSettings) {
      setTempNotificationTimes(notificationSettings.times || ['evening']);
      setVibrationEnabled(notificationSettings.vibrationEnabled);
    }
  }, [notificationSettings]);

  const handleSaveProfile = async () => {
    try {
      await updateDisplayName(displayName);
      // Note: bio functionality would need to be added to the useUserProfile hook
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await enableNotifications(tempNotificationTimes as any);
      if (!success) {
        toast.error('Failed to enable notifications');
      }
    } else {
      await disableNotifications();
    }
  };

  const handleNotificationTimesChange = async (newTimes: string[]) => {
    setTempNotificationTimes(newTimes);
    if (notificationSettings.enabled) {
      await updateSettings({ times: newTimes as any });
    }
  };

  const handleVibrationToggle = async (enabled: boolean) => {
    setVibrationEnabled(enabled);
    await updateSettings({ vibrationEnabled: enabled });
  };

  const handleColorChange = (color: string) => {
    setAccentColor(color);
    // Apply the color to CSS variables or theme context
    document.documentElement.style.setProperty('--theme-color', color);
  };

  const getPermissionBadge = () => {
    if (notificationLoading) {
      return <Badge variant="secondary">Loading...</Badge>;
    }

    switch (permissionStatus?.status) {
      case 'granted':
        return <Badge variant="default" className="bg-green-500">Enabled</Badge>;
      case 'denied':
        return <Badge variant="destructive">Blocked</Badge>;
      default:
        return <Badge variant="secondary">Not Set</Badge>;
    }
  };

  if (profileLoading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="space-y-6">
          <div className="h-8 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          <TranslatableText text="Settings" />
        </h1>
        <NotificationCenter />
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <TranslatableText text="Profile" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback>
                {displayName?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <ProfilePictureUpload />
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">
              <TranslatableText text="Display Name" />
            </Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">
              <TranslatableText text="Bio" />
            </Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
            />
          </div>

          <Button onClick={handleSaveProfile} className="w-full">
            <TranslatableText text="Save Profile" />
          </Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <TranslatableText text="Notifications" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Permission Status */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                <TranslatableText text="Permission Status" />
              </Label>
              <p className="text-xs text-muted-foreground">
                <TranslatableText text="Current notification permission state" />
              </p>
            </div>
            {getPermissionBadge()}
          </div>

          <Separator />

          {/* Enable Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                <TranslatableText text="Enable Notifications" />
              </Label>
              <p className="text-xs text-muted-foreground">
                <TranslatableText text="Receive journal reminders and updates" />
              </p>
            </div>
            <Switch
              checked={notificationSettings.enabled && hasPermission}
              onCheckedChange={handleNotificationToggle}
              disabled={notificationLoading || (!hasPermission && !canRequestPermission)}
            />
          </div>

          {/* Notification Times */}
          {notificationSettings.enabled && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                <TranslatableText text="Reminder Times" />
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {['morning', 'afternoon', 'evening', 'night'].map((time) => (
                  <div key={time} className="flex items-center space-x-2">
                    <Switch
                      id={time}
                      checked={tempNotificationTimes.includes(time)}
                      onCheckedChange={(checked) => {
                        const newTimes = checked
                          ? [...tempNotificationTimes, time]
                          : tempNotificationTimes.filter(t => t !== time);
                        handleNotificationTimesChange(newTimes);
                      }}
                    />
                    <Label htmlFor={time} className="text-sm capitalize">
                      <TranslatableText text={time} />
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vibration */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Vibrate className="h-4 w-4" />
                <TranslatableText text="Vibration" />
              </Label>
              <p className="text-xs text-muted-foreground">
                <TranslatableText text="Enable haptic feedback for notifications" />
              </p>
            </div>
            <Switch
              checked={vibrationEnabled}
              onCheckedChange={handleVibrationToggle}
              disabled={notificationLoading}
            />
          </div>

          {/* Test Notification */}
          <Button
            onClick={testNotification}
            variant="outline"
            className="w-full"
            disabled={!hasPermission || notificationLoading}
          >
            <TranslatableText text="Test Notification" />
          </Button>

          {/* Environment Info */}
          {deviceInfo && (
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <p className="text-xs font-medium">
                <TranslatableText text="Environment Information" />
              </p>
              <p className="text-xs text-muted-foreground">
                Platform: {deviceInfo.platform} | 
                {deviceInfo.isNative ? ' Native App' : ' Web Browser'} |
                {deviceInfo.isMobile ? ' Mobile' : ' Desktop'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appearance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            <TranslatableText text="Appearance" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              <TranslatableText text="Theme" />
            </Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger>
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

          {/* Color Picker */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              <TranslatableText text="Accent Color" />
            </Label>
            <ColorPicker 
              value={accentColor}
              onChange={handleColorChange}
              applyImmediately={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <TranslatableText text="Language" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LanguageSelector />
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
