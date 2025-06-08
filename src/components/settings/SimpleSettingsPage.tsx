
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useSettingsData } from '@/hooks/use-settings-data';
import { SettingsLoadingSkeleton } from '@/components/settings/SettingsLoadingWrapper';
import { SubscriptionManagement } from '@/components/settings/SubscriptionManagement';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Simple Profile section component
const ProfileSection: React.FC<{ hasProfile: boolean; error?: string | null }> = ({ 
  hasProfile, 
  error 
}) => {
  console.log('[ProfileSection] Rendering - hasProfile:', hasProfile, 'error:', error);

  if (error) {
    console.error('[ProfileSection] Error:', error);
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-yellow-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">
            <TranslatableText text="Profile temporarily unavailable" />
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <TranslatableText text="Profile" />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <p className="text-sm text-muted-foreground">
          <TranslatableText text={hasProfile ? "Profile settings are available." : "Profile is being set up."} />
        </p>
      </CardContent>
    </Card>
  );
};

// Simple Preferences section component
const PreferencesSection: React.FC = () => {
  console.log('[PreferencesSection] Rendering...');

  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <TranslatableText text="Preferences" />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <p className="text-sm text-muted-foreground">
          <TranslatableText text="App preferences are ready." />
        </p>
      </CardContent>
    </Card>
  );
};

export const SimpleSettingsPage: React.FC = () => {
  console.log('[SimpleSettingsPage] Component mounting...');
  
  const settingsData = useSettingsData();

  console.log('[SimpleSettingsPage] Settings data:', settingsData);

  const handleRefresh = () => {
    console.log('[SimpleSettingsPage] Refreshing page...');
    window.location.reload();
  };

  // Show critical error state
  if (settingsData.error && !settingsData.canShowSettings) {
    console.error('[SimpleSettingsPage] Critical error:', settingsData.error);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-2" />
            <CardTitle className="text-lg text-red-600">
              <TranslatableText text="Settings Unavailable" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              {settingsData.error}
            </p>
            <Button 
              onClick={handleRefresh}
              className="w-full"
              variant="default"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              <TranslatableText text="Retry" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading
  if (settingsData.isLoading) {
    console.log('[SimpleSettingsPage] Showing loading skeleton');
    return <SettingsLoadingSkeleton />;
  }

  console.log('[SimpleSettingsPage] Rendering main settings UI');
  
  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-3xl mx-auto px-4 pt-2">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">
            <TranslatableText text="Settings" />
          </h1>
          <p className="text-muted-foreground">
            <TranslatableText text="Manage your account and app preferences" />
          </p>
        </div>

        {/* Error state indicator */}
        {settingsData.error && (
          <Alert className="mb-6 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <TranslatableText text="Some settings may be temporarily unavailable" />
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Profile Section */}
          <ProfileSection 
            hasProfile={settingsData.hasProfile}
            error={settingsData.error}
          />

          {/* Subscription Section */}
          {settingsData.hasSubscription || !settingsData.isLoading ? (
            <SubscriptionManagement />
          ) : (
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm">
                  <TranslatableText text="Loading subscription..." />
                </span>
              </div>
            </Card>
          )}

          {/* Preferences Section */}
          <PreferencesSection />

          {/* Success state indicator */}
          {settingsData.canShowSettings && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <TranslatableText text="Settings loaded successfully" />
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
};
