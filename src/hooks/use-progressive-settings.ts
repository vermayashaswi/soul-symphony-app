
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
  console.log('[useProgressiveSettings] Hook initializing...');
  
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

  console.log('[useProgressiveSettings] Current state:', state);
  console.log('[useProgressiveSettings] Auth state - user:', !!user);
  console.log('[useProgressiveSettings] Profile state:', { profile, profileLoading, profileError });
  console.log('[useProgressiveSettings] Subscription state:', { isPremium, subscriptionLoading, subscriptionError });

  // Phase 1: Initialize with user authentication check
  useEffect(() => {
    const initializeSettings = async () => {
      console.log('[useProgressiveSettings] Phase 1: Initializing settings');
      console.log('[useProgressiveSettings] User available:', !!user);
      
      if (!user) {
        console.error('[useProgressiveSettings] No user found, setting critical error');
        setState(prev => ({
          ...prev,
          criticalError: 'User not authenticated',
          isInitialLoading: false,
        }));
        return;
      }

      console.log('[useProgressiveSettings] User authenticated, proceeding with initialization');
      // Set initial loading to false after user is confirmed
      setState(prev => ({
        ...prev,
        isInitialLoading: false,
      }));
    };

    initializeSettings().catch(error => {
      console.error('[useProgressiveSettings] Error in initialization:', error);
      setState(prev => ({
        ...prev,
        criticalError: `Initialization failed: ${error.message}`,
        isInitialLoading: false,
      }));
    });
  }, [user]);

  // Phase 2: Load profile data
  useEffect(() => {
    console.log('[useProgressiveSettings] Phase 2: Processing profile data');
    console.log('[useProgressiveSettings] Profile loading:', profileLoading, 'Error:', profileError, 'Data:', !!profile);
    
    try {
      setState(prev => ({
        ...prev,
        isProfileLoading: profileLoading,
        profileError: profileError || null,
        hasProfile: !!profile,
      }));
    } catch (error) {
      console.error('[useProgressiveSettings] Error updating profile state:', error);
      setState(prev => ({
        ...prev,
        profileError: `Profile state error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isProfileLoading: false,
      }));
    }
  }, [profile, profileLoading, profileError]);

  // Phase 3: Load subscription data
  useEffect(() => {
    console.log('[useProgressiveSettings] Phase 3: Processing subscription data');
    console.log('[useProgressiveSettings] Subscription loading:', subscriptionLoading, 'Error:', subscriptionError, 'isPremium:', isPremium);
    
    try {
      setState(prev => ({
        ...prev,
        isSubscriptionLoading: subscriptionLoading,
        subscriptionError: subscriptionError || null,
        hasSubscription: isPremium !== undefined,
      }));
    } catch (error) {
      console.error('[useProgressiveSettings] Error updating subscription state:', error);
      setState(prev => ({
        ...prev,
        subscriptionError: `Subscription state error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isSubscriptionLoading: false,
      }));
    }
  }, [isPremium, subscriptionLoading, subscriptionError]);

  // Phase 4: Load preferences (simplified for now)
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        console.log('[useProgressiveSettings] Phase 4: Loading preferences');
        
        // Simplified preferences loading - just set as ready
        setState(prev => ({
          ...prev,
          isPreferencesLoading: false,
          hasPreferences: true,
        }));
        
        console.log('[useProgressiveSettings] Preferences loaded successfully');
      } catch (error) {
        console.error('[useProgressiveSettings] Error loading preferences:', error);
        setState(prev => ({
          ...prev,
          isPreferencesLoading: false,
          preferencesError: `Failed to load preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }));
      }
    };

    // Only start loading preferences after profile is available (or failed)
    if (!state.isProfileLoading) {
      console.log('[useProgressiveSettings] Profile loading complete, starting preferences...');
      loadPreferences();
    }
  }, [state.isProfileLoading]);

  // Update overall ready state
  useEffect(() => {
    console.log('[useProgressiveSettings] Checking ready state...');
    
    const isReady = !state.isInitialLoading && 
                   !state.isProfileLoading && 
                   !state.isSubscriptionLoading && 
                   !state.isPreferencesLoading &&
                   !state.criticalError;

    console.log('[useProgressiveSettings] Ready state calculation:', {
      isInitialLoading: state.isInitialLoading,
      isProfileLoading: state.isProfileLoading,
      isSubscriptionLoading: state.isSubscriptionLoading,
      isPreferencesLoading: state.isPreferencesLoading,
      criticalError: state.criticalError,
      calculatedReady: isReady
    });

    setState(prev => ({
      ...prev,
      isReady,
    }));

    if (isReady) {
      console.log('[useProgressiveSettings] ✅ All phases complete, settings ready');
    }
  }, [
    state.isInitialLoading,
    state.isProfileLoading,
    state.isSubscriptionLoading,
    state.isPreferencesLoading,
    state.criticalError,
  ]);

  const refresh = useCallback(async () => {
    console.log('[useProgressiveSettings] 🔄 Refreshing all settings data');
    setState(prev => ({
      ...prev,
      isInitialLoading: true,
      profileError: null,
      subscriptionError: null,
      preferencesError: null,
      criticalError: null,
    }));
    
    // Trigger re-initialization by reloading the page
    console.log('[useProgressiveSettings] Reloading page to reset state');
    window.location.reload();
  }, []);

  const finalState = {
    ...state,
    refresh,
    // Convenience getters
    canShowProfile: state.hasProfile || !state.isProfileLoading,
    canShowSubscription: state.hasSubscription || !state.isSubscriptionLoading,
    canShowPreferences: state.hasPreferences || !state.isPreferencesLoading,
  };

  console.log('[useProgressiveSettings] Final state being returned:', {
    isReady: finalState.isReady,
    canShowProfile: finalState.canShowProfile,
    canShowSubscription: finalState.canShowSubscription,
    canShowPreferences: finalState.canShowPreferences,
    errors: {
      critical: finalState.criticalError,
      profile: finalState.profileError,
      subscription: finalState.subscriptionError,
      preferences: finalState.preferencesError,
    }
  });

  return finalState;
};
