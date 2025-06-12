
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Bell, BellOff, Smartphone, Globe, TestTube, Palette, User, Download, Trash2, Coffee, Sun, Sunset, Moon, Loader2 } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { ColorPicker } from '@/components/settings/ColorPicker';
import { LanguageSelector } from '@/components/LanguageSelector';
import { SubscriptionManagement } from '@/components/settings/SubscriptionManagement';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { SettingsLoadingWrapper } from '@/components/settings/SettingsLoadingWrapper';
import { SettingsErrorBoundary } from '@/components/settings/SettingsErrorBoundary';
import { useSettingsNotifications } from '@/hooks/use-settings-notifications';
import { type NotificationTime } from '@/services/notificationService';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

const Settings: React.FC = () => {
  const { profile, updateProfile, isLoading: profileLoading } = useUserProfile();
  const {
    enabled: notificationsEnabled,
    times: notificationTimes,
    isLoading: notificationLoading,
    permissionGranted,
    permissionDenied,
    canRequest,
    isMobile,
    isWebToNative,
    requestPermissionAndEnable,
    disableNotifications,
    updateSettings,
    resetToggleState,
    showTestNotification,
    vibrate
  } = useSettingsNotifications();

  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [pendingNotificationTimes, setPendingNotificationTimes] = useState<NotificationTime[]>([]);

  // Reset pending times when modal closes
  useEffect(() => {
    if (!showNotificationModal) {
      setPendingNotificationTimes([]);
    }
  }, [showNotificationModal]);

  const handleToggleNotifications = async (checked: boolean) => {
    console.log('[Settings] Toggle notifications:', checked);

    if (!checked) {
      // Disable notifications immediately
      disableNotifications();
      return;
    }

    // Check if we need permission
    if (!permissionGranted) {
      if (canRequest) {
        // Show modal to select times and request permission
        setShowNotificationModal(true);
        setPendingNotificationTimes(['morning', 'evening']); // Default selection
      } else if (permissionDenied) {
        // Permission was denied, show instructions
        toast.error(
          isMobile || isWebToNative 
            ? 'Notifications are blocked. Please enable them in your device settings.'
            : 'Notifications are blocked. Please enable them in your browser settings.'
        );
      }
      return;
    }

    // Permission already granted, show time selection modal
    setShowNotificationModal(true);
    setPendingNotificationTimes(notificationTimes.length > 0 ? notificationTimes : ['morning', 'evening']);
  };

  const handleConfirmNotificationSettings = async () => {
    if (pendingNotificationTimes.length === 0) {
      toast.error('Please select at least one notification time');
      return;
    }

    const success = await requestPermissionAndEnable(pendingNotificationTimes);
    
    if (success) {
      setShowNotificationModal(false);
      setPendingNotificationTimes([]);
    }
    // If failed, modal stays open for user to try again or cancel
  };

  const handleCancelNotificationSettings = () => {
    console.log('[Settings] Cancel notification settings');
    
    // Reset the toggle state if notifications were not previously enabled
    if (!notificationsEnabled) {
      resetToggleState();
    }
    
    setShowNotificationModal(false);
    setPendingNotificationTimes([]);
  };

  const handleTestNotification = () => {
    if (!permissionGranted) {
      toast.error('Please enable notifications first');
      return;
    }

    if (showTestNotification) {
      showTestNotification(
        'Test Notification 🧪',
        'This is a test notification from your voice journaling app!',
        { tag: 'test-notification' }
      );
      
      // Add vibration for mobile
      if (isMobile && vibrate) {
        vibrate(200);
      }
      
      toast.success('Test notification sent!');
    }
  };

  const handleTimeToggle = (time: NotificationTime, checked: boolean) => {
    if (checked) {
      setPendingNotificationTimes(prev => [...prev, time]);
    } else {
      setPendingNotificationTimes(prev => prev.filter(t => t !== time));
    }
  };

  const timeOptions: { time: NotificationTime; label: string; icon: React.ReactNode; description: string }[] = [
    { time: 'morning', label: 'Morning', icon: <Coffee className="h-4 w-4" />, description: '8:00 AM' },
    { time: 'afternoon', label: 'Afternoon', icon: <Sun className="h-4 w-4" />, description: '2:00 PM' },
    { time: 'evening', label: 'Evening', icon: <Sunset className="h-4 w-4" />, description: '7:00 PM' },
    { time: 'night', label: 'Night', icon: <Moon className="h-4 w-4" />, description: '10:00 PM' }
  ];

  const getNotificationStatusBadge = () => {
    if (notificationLoading) {
      return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Loading</Badge>;
    }
    
    if (permissionGranted && notificationsEnabled) {
      return <Badge variant="default" className="bg-green-500"><Bell className="h-3 w-3 mr-1" />Enabled</Badge>;
    }
    
    if (permissionDenied) {
      return <Badge variant="destructive"><BellOff className="h-3 w-3 mr-1" />Blocked</Badge>;
    }
    
    return <Badge variant="secondary"><BellOff className="h-3 w-3 mr-1" />Disabled</Badge>;
  };

  const clearAllData = () => {
    if (window.confirm('Are you sure you want to clear all your data? This action cannot be undone.')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  if (profileLoading) {
    return <SettingsLoadingWrapper />;
  }

  return (
    <SettingsErrorBoundary>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              <TranslatableText text="Settings" />
            </h1>
            <p className="text-muted-foreground">
              <TranslatableText text="Manage your account settings and preferences" />
            </p>
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
              <ProfilePictureUpload />
              <ColorPicker />
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isMobile || isWebToNative ? <Smartphone className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                <TranslatableText text={isMobile || isWebToNative ? "Mobile Notifications" : "Notifications"} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Environment Info */}
              {isWebToNative && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Smartphone className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    <TranslatableText text="Running in native mobile app" />
                  </span>
                </div>
              )}

              {/* Notification Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      <TranslatableText text="Enable Notifications" />
                    </span>
                    {getNotificationStatusBadge()}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Get reminded to journal at your preferred times" />
                  </p>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={handleToggleNotifications}
                  disabled={notificationLoading}
                />
              </div>

              {/* Current Schedule */}
              {notificationsEnabled && notificationTimes.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">
                    <TranslatableText text="Current Schedule" />
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {notificationTimes.map(time => {
                      const option = timeOptions.find(opt => opt.time === time);
                      return option ? (
                        <Badge key={time} variant="outline" className="flex items-center gap-1">
                          {option.icon}
                          <TranslatableText text={option.label} />
                          <span className="text-xs">({option.description})</span>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* Test Notification */}
              <Button
                onClick={handleTestNotification}
                variant="outline"
                size="sm"
                disabled={!permissionGranted || notificationLoading}
                className="w-full sm:w-auto"
              >
                <TestTube className="h-4 w-4 mr-2" />
                <TranslatableText text="Test Notification" />
              </Button>

              {/* Permission Instructions */}
              {permissionDenied && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {isMobile || isWebToNative ? (
                      <TranslatableText text="To enable notifications, go to your device's app settings and allow notifications for this app." />
                    ) : (
                      <TranslatableText text="To enable notifications, click the lock icon in your browser's address bar and allow notifications for this site." />
                    )}
                  </p>
                </div>
              )}
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

          {/* Subscription Management */}
          <SubscriptionManagement />

          {/* App Installation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                <TranslatableText text="Install App" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PWAInstallPrompt />
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                <TranslatableText text="Data Management" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={clearAllData} variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                <TranslatableText text="Clear All Data" />
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                <TranslatableText text="This will delete all your journal entries, settings, and preferences. This action cannot be undone." />
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Notification Settings Modal */}
        <Dialog open={showNotificationModal} onOpenChange={setShowNotificationModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <TranslatableText text="Notification Settings" />
              </DialogTitle>
              <DialogDescription>
                <TranslatableText text="Choose when you'd like to receive journal reminders" />
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {timeOptions.map(option => (
                <div key={option.time} className="flex items-center space-x-3">
                  <Checkbox
                    id={option.time}
                    checked={pendingNotificationTimes.includes(option.time)}
                    onCheckedChange={(checked) => handleTimeToggle(option.time, !!checked)}
                  />
                  <label htmlFor={option.time} className="flex items-center gap-2 cursor-pointer flex-1">
                    {option.icon}
                    <div>
                      <div className="font-medium">
                        <TranslatableText text={option.label} />
                      </div>
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={handleCancelNotificationSettings}
                disabled={notificationLoading}
              >
                <TranslatableText text="Cancel" />
              </Button>
              <Button 
                onClick={handleConfirmNotificationSettings}
                disabled={notificationLoading || pendingNotificationTimes.length === 0}
              >
                {notificationLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <TranslatableText text="Enable Notifications" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsErrorBoundary>
  );
};

export default Settings;
