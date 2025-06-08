
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useUserProfile } from '@/hooks/useUserProfile';

interface SettingsData {
  isLoading: boolean;
  error: string | null;
  hasProfile: boolean;
  hasSubscription: boolean;
  canShowSettings: boolean;
}

export const useSettingsData = () => {
  console.log('[useSettingsData] Hook initializing...');
  
  const { user } = useAuth();
  const { 
    isPremium, 
    isLoading: subscriptionLoading, 
    error: subscriptionError 
  } = useSubscription();
  const { 
    profile, 
    isLoading: profileLoading, 
    error: profileError 
  } = useUserProfile();

  const [settingsData, setSettingsData] = useState<SettingsData>({
    isLoading: true,
    error: null,
    hasProfile: false,
    hasSubscription: false,
    canShowSettings: false,
  });

  console.log('[useSettingsData] Current state:', {
    user: !!user,
    profileLoading,
    subscriptionLoading,
    profile: !!profile,
    isPremium,
    profileError,
    subscriptionError
  });

  useEffect(() => {
    const updateSettingsData = () => {
      console.log('[useSettingsData] Updating settings data...');
      
      if (!user) {
        console.log('[useSettingsData] No user found');
        setSettingsData({
          isLoading: false,
          error: 'User not authenticated',
          hasProfile: false,
          hasSubscription: false,
          canShowSettings: false,
        });
        return;
      }

      const isLoading = profileLoading || subscriptionLoading;
      const hasError = profileError || subscriptionError;
      const hasProfile = !!profile;
      const hasSubscription = isPremium !== undefined;
      
      console.log('[useSettingsData] Data status:', {
        isLoading,
        hasError,
        hasProfile,
        hasSubscription
      });

      setSettingsData({
        isLoading,
        error: hasError ? (profileError || subscriptionError) : null,
        hasProfile,
        hasSubscription,
        canShowSettings: !isLoading && !hasError,
      });
    };

    updateSettingsData();
  }, [user, profileLoading, subscriptionLoading, profile, isPremium, profileError, subscriptionError]);

  console.log('[useSettingsData] Returning data:', settingsData);

  return settingsData;
};
