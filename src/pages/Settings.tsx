
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Crown, Settings as SettingsIcon, Bell, Palette, Globe, Smartphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { SubscriptionBadge } from '@/components/settings/SubscriptionBadge';
import { SettingsErrorBoundary } from '@/components/settings/SettingsErrorBoundary';
import { SettingsLoadingWrapper } from '@/components/settings/SettingsLoadingWrapper';
import { FeatureFlagDemo } from '@/components/FeatureFlagDemo';
import { useUserSession } from '@/hooks/useUserSession';

const Settings: React.FC = () => {
  const { user, signOut } = useAuth();
  const { hasActiveSubscription, isTrialActive, tier, status, isLoading: subscriptionLoading } = useSubscription();
  const navigate = useNavigate();
  const { trackConversion } = useUserSession();

  const handleSignOut = async () => {
    try {
      await trackConversion('user_logout');
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleUpgradeClick = () => {
    trackConversion('upgrade_button_click', { source: 'settings' });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">
            <TranslatableText text="Authentication Required" />
          </h2>
          <p className="text-muted-foreground mb-4">
            <TranslatableText text="Please sign in to access settings" />
          </p>
          <Button onClick={() => navigate('/app/auth')}>
            <TranslatableText text="Sign In" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SettingsErrorBoundary>
      <SettingsLoadingWrapper isLoading={subscriptionLoading}>
        <div className="min-h-screen pb-20">
          <div className="max-w-3xl mx-auto px-4 pt-2">
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2">
                <TranslatableText text="Settings" />
              </h1>
              <p className="text-muted-foreground">
                <TranslatableText text="Manage your account preferences and subscription" />
              </p>
            </div>

            <div className="space-y-6">
              {/* Profile Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      <TranslatableText text="Profile" />
                    </CardTitle>
                    <SubscriptionBadge 
                      isPremium={hasActiveSubscription}
                      isTrialActive={isTrialActive}
                      subscriptionStatus={status}
                      isLoading={subscriptionLoading}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                    <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 space-y-4 text-center sm:text-left">
                      <div>
                        <h3 className="text-lg font-semibold">{user.email}</h3>
                        <p className="text-sm text-muted-foreground">
                          <TranslatableText text="Member since" /> {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="text-sm font-medium">
                            <TranslatableText text="Account Type" />
                          </div>
                          <div className="text-lg font-semibold capitalize">
                            {tier || 'free'}
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="text-sm font-medium">
                            <TranslatableText text="Status" />
                          </div>
                          <div className="text-lg font-semibold capitalize">
                            {status || 'active'}
                          </div>
                        </div>
                      </div>

                      <Button variant="outline" size="sm">
                        <TranslatableText text="Edit Profile" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Feature Flags Demo */}
              <FeatureFlagDemo />

              {/* Subscription Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5" />
                      <TranslatableText text="Subscription" />
                    </CardTitle>
                    <Badge variant={hasActiveSubscription ? "default" : "secondary"}>
                      {hasActiveSubscription ? (
                        <TranslatableText text="Active" />
                      ) : (
                        <TranslatableText text="Free Plan" />
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        <TranslatableText text="Current Plan" />
                      </span>
                      <span className="text-sm capitalize">{tier}</span>
                    </div>
                    
                    {!hasActiveSubscription && (
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg p-4">
                        <h4 className="font-medium mb-2">
                          <TranslatableText text="Upgrade to Premium" />
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          <TranslatableText text="Unlock advanced features and unlimited access" />
                        </p>
                        <Button size="sm" onClick={handleUpgradeClick}>
                          <Crown className="h-4 w-4 mr-2" />
                          <TranslatableText text="Upgrade Now" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Settings Sections */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5" />
                    <TranslatableText text="Preferences" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Bell className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        <TranslatableText text="Notifications" />
                      </span>
                    </div>
                    <Button variant="ghost" size="sm">
                      <TranslatableText text="Configure" />
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Palette className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        <TranslatableText text="Appearance" />
                      </span>
                    </div>
                    <Button variant="ghost" size="sm">
                      <TranslatableText text="Customize" />
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        <TranslatableText text="Language" />
                      </span>
                    </div>
                    <Button variant="ghost" size="sm">
                      <TranslatableText text="Change" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Sign Out */}
              <Card>
                <CardContent className="pt-6">
                  <Button 
                    variant="destructive" 
                    onClick={handleSignOut}
                    className="w-full"
                  >
                    <TranslatableText text="Sign Out" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SettingsLoadingWrapper>
    </SettingsErrorBoundary>
  );
};

export default Settings;
