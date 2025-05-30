
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, User, Palette, Bell, Crown, Smartphone } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { LanguageSelector } from '@/components/translation/LanguageSelector';
import { ColorPickerWrapper } from '@/components/settings/ColorPickerWrapper';
import { SubscriptionManagement } from '@/components/settings/SubscriptionManagement';
import { SubscriptionErrorBoundary } from '@/components/settings/SubscriptionErrorBoundary';
import { SettingsLoadingWrapper } from '@/components/settings/SettingsLoadingWrapper';
import { ProfilePictureUpload } from '@/components/settings/ProfilePictureUpload';
import { useUserProfile } from '@/hooks/useUserProfile';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const { isInitialLoading: isSubscriptionInitialLoading, error: subscriptionError } = useSubscription();
  const { profile, updateProfileField, isLoading: isProfileLoading, error: profileError } = useUserProfile();
  const [searchParams] = useSearchParams();
  
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  // Check for tab parameter in URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['profile', 'subscription', 'appearance'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || profile.full_name || '');
      setEmail(profile.email || user?.email || '');
    } else if (user) {
      setEmail(user.email || '');
      setDisplayName(user.user_metadata?.full_name || '');
    }
  }, [profile, user]);

  const handleSaveProfile = async () => {
    if (!profile) return;

    try {
      await updateProfileField('display_name', displayName);
      toast.success(<TranslatableText text="Profile updated successfully" forceTranslate={true} />);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(<TranslatableText text="Failed to update profile" forceTranslate={true} />);
    }
  };

  const isInitialLoading = isSubscriptionInitialLoading || isProfileLoading;
  const hasError = subscriptionError || profileError;

  return (
    <SettingsLoadingWrapper 
      isInitialLoading={isInitialLoading} 
      error={hasError}
    >
      <div className="min-h-screen pb-20">
        <div className="max-w-3xl mx-auto px-4 pt-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6"
          >
            <h1 className="text-3xl font-bold tracking-tight text-theme-color">
              <TranslatableText text="Settings" />
            </h1>
            <p className="text-muted-foreground">
              <TranslatableText text="Manage your account settings and preferences." />
            </p>
          </motion.div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">
                <User className="h-4 w-4 mr-2" />
                <TranslatableText text="Profile" />
              </TabsTrigger>
              <TabsTrigger value="subscription">
                <Crown className="h-4 w-4 mr-2" />
                <TranslatableText text="Subscription" />
              </TabsTrigger>
              <TabsTrigger value="appearance">
                <Palette className="h-4 w-4 mr-2" />
                <TranslatableText text="Appearance" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-theme-color">
                      <TranslatableText text="Profile Information" />
                    </CardTitle>
                    <CardDescription>
                      <TranslatableText text="Update your profile information and preferences." />
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                      <ProfilePictureUpload />
                      
                      <div className="flex-1 space-y-4 text-center sm:text-left">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>
                            <TranslatableText text="Language" />
                          </Label>
                          <LanguageSelector />
                        </div>
                        
                        <Button onClick={handleSaveProfile} className="w-full sm:w-auto">
                          <TranslatableText text="Save Changes" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="subscription">
              <SubscriptionErrorBoundary>
                <SubscriptionManagement />
              </SubscriptionErrorBoundary>
            </TabsContent>

            <TabsContent value="appearance">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-theme-color">
                      <TranslatableText text="Appearance" />
                    </CardTitle>
                    <CardDescription>
                      <TranslatableText text="Customize the look and feel of your application." />
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ColorPickerWrapper />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SettingsLoadingWrapper>
  );
};

export default Settings;
