
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useUserProfile } from '@/hooks/useUserProfile';

interface ProgressiveSettingsState {
  // Loading states
  isInitialLoading: boolean;
  isProfileLoading: boolean;
  isSubscriptionLoading: boolean;
  isPreferencesLoading: boolean;
  
  // Error states
  profileError: string | null;
  subscriptionError: string | null;
  preferencesError: string | null;
  
  // Data availability
  hasProfile: boolean;
  hasSubscription: boolean;
  hasPreferences: boolean;
  
  // Overall state
  isReady: boolean;
  criticalError: string | null;
}

export const useProgressiveSettings = () => {
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

  const [state, setState] = useState<ProgressiveSettingsState>({
    isInitialLoading: true,
    isProfileLoading: true,
    isSubscriptionLoading: true,
    isPreferencesLoading: true,
    profileError: null,
    subscriptionError: null,
    preferencesError: null,
    hasProfile: false,
    hasSubscription: false,
    hasPreferences: false,
    isReady: false,
    criticalError: null,
  });

  // Phase 1: Initialize with user authentication check
  useEffect(() => {
    const initializeSettings = async () => {
      console.log('[ProgressiveSettings] Phase 1: Initializing settings');
      
      if (!user) {
        setState(prev => ({
          ...prev,
          criticalError: 'User not authenticated',
          isInitialLoading: false,
        }));
        return;
      }

      // Set initial loading to false after user is confirmed
      setState(prev => ({
        ...prev,
        isInitialLoading: false,
      }));
    };

    initializeSettings();
  }, [user]);

  // Phase 2: Load profile data
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isProfileLoading: profileLoading,
      profileError: profileError || null,
      hasProfile: !!profile,
    }));
  }, [profile, profileLoading, profileError]);

  // Phase 3: Load subscription data
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isSubscriptionLoading: subscriptionLoading,
      subscriptionError: subscriptionError || null,
      hasSubscription: isPremium !== undefined,
    }));
  }, [isPremium, subscriptionLoading, subscriptionError]);

  // Phase 4: Load preferences (mock for now, can be extended)
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        console.log('[ProgressiveSettings] Phase 4: Loading preferences');
        
        // Simulate preferences loading
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setState(prev => ({
          ...prev,
          isPreferencesLoading: false,
          hasPreferences: true,
        }));
      } catch (error) {
        console.error('[ProgressiveSettings] Error loading preferences:', error);
        setState(prev => ({
          ...prev,
          isPreferencesLoading: false,
          preferencesError: 'Failed to load preferences',
        }));
      }
    };

    // Only start loading preferences after profile is ready
    if (state.hasProfile && !state.isProfileLoading) {
      loadPreferences();
    }
  }, [state.hasProfile, state.isProfileLoading]);

  // Update overall ready state
  useEffect(() => {
    const isReady = !state.isInitialLoading && 
                   !state.isProfileLoading && 
                   !state.isSubscriptionLoading && 
                   !state.isPreferencesLoading &&
                   !state.criticalError;

    setState(prev => ({
      ...prev,
      isReady,
    }));

    if (isReady) {
      console.log('[ProgressiveSettings] All phases complete, settings ready');
    }
  }, [
    state.isInitialLoading,
    state.isProfileLoading,
    state.isSubscriptionLoading,
    state.isPreferencesLoading,
    state.criticalError,
  ]);

  const refresh = useCallback(async () => {
    console.log('[ProgressiveSettings] Refreshing all settings data');
    setState(prev => ({
      ...prev,
      isInitialLoading: true,
      profileError: null,
      subscriptionError: null,
      preferencesError: null,
      criticalError: null,
    }));
    
    // Trigger re-initialization
    window.location.reload();
  }, []);

  return {
    ...state,
    refresh,
    // Convenience getters
    canShowProfile: state.hasProfile || !state.isProfileLoading,
    canShowSubscription: state.hasSubscription || !state.isSubscriptionLoading,
    canShowPreferences: state.hasPreferences || !state.isPreferencesLoading,
  };
};
