
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useProgressiveSettings } from '@/hooks/use-progressive-settings';
import { SettingsLoadingSkeleton } from '@/components/settings/SettingsLoadingWrapper';
import { SubscriptionManagement } from '@/components/settings/SubscriptionManagement';
import { AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Profile section component
const ProfileSection: React.FC<{ isLoading: boolean; error?: string | null }> = ({ 
  isLoading, 
  error 
}) => {
  console.log('[ProfileSection] Rendering - isLoading:', isLoading, 'error:', error);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4" />
          <div className="flex items-center gap-4 mb-4">
            <div className="h-16 w-16 bg-muted rounded-full" />
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-32" />
              <div className="h-3 bg-muted rounded w-24" />
            </div>
          </div>
        </div>
      </Card>
    );
  }

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
          <TranslatableText text="Profile settings are available." />
        </p>
      </CardContent>
    </Card>
  );
};

// Preferences section component
const PreferencesSection: React.FC<{ isLoading: boolean; error?: string | null }> = ({ 
  isLoading, 
  error 
}) => {
  console.log('[PreferencesSection] Rendering - isLoading:', isLoading, 'error:', error);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/4 mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-10 bg-muted rounded w-full" />
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    console.error('[PreferencesSection] Error:', error);
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-yellow-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">
            <TranslatableText text="Preferences temporarily unavailable" />
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

export const ProgressiveSettingsPage: React.FC = () => {
  console.log('[ProgressiveSettingsPage] Component mounting...');
  
  const settingsState = useProgressiveSettings();

  console.log('[ProgressiveSettingsPage] Settings state:', {
    isReady: settingsState.isReady,
    isInitialLoading: settingsState.isInitialLoading,
    criticalError: settingsState.criticalError,
    profileError: settingsState.profileError,
    subscriptionError: settingsState.subscriptionError,
    preferencesError: settingsState.preferencesError,
  });

  // Show critical error state
  if (settingsState.criticalError) {
    console.error('[ProgressiveSettingsPage] Critical error:', settingsState.criticalError);
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
              {settingsState.criticalError}
            </p>
            <Button 
              onClick={settingsState.refresh}
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

  // Show initial loading
  if (settingsState.isInitialLoading) {
    console.log('[ProgressiveSettingsPage] Showing initial loading skeleton');
    return <SettingsLoadingSkeleton />;
  }

  console.log('[ProgressiveSettingsPage] Rendering main settings UI');
  
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

        {/* Loading Progress Indicator */}
        {!settingsState.isReady && (
          <Alert className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <TranslatableText text="Loading settings..." />
              {!settingsState.canShowProfile && " Profile"}
              {!settingsState.canShowSubscription && " Subscription"}
              {!settingsState.canShowPreferences && " Preferences"}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Profile Section */}
          <ProfileSection 
            isLoading={settingsState.isProfileLoading}
            error={settingsState.profileError}
          />

          {/* Subscription Section */}
          {settingsState.canShowSubscription ? (
            <SubscriptionManagement />
          ) : (
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  <TranslatableText text="Loading subscription..." />
                </span>
              </div>
            </Card>
          )}

          {/* Preferences Section */}
          <PreferencesSection 
            isLoading={settingsState.isPreferencesLoading}
            error={settingsState.preferencesError}
          />

          {/* Ready State Indicator */}
          {settingsState.isReady && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <TranslatableText text="All settings loaded successfully" />
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
};
