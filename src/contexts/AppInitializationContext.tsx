import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAppInitialization } from '@/hooks/useAppInitialization';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { subscriptionErrorHandler } from '@/services/subscriptionErrorHandler';

interface InitializationPhase {
  fonts: boolean;
  auth: boolean;
  onboarding: boolean;
  voiceOnboarding: boolean;
  appServices: boolean;
  subscription: boolean;
  contextProviders: boolean;
}

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trial' | 'free' | 'unknown';

interface AppInitializationState {
  isAppReady: boolean;
  phases: InitializationPhase;
  progress: number;
  currentPhase: string;
  error: string | null;
  // Subscription data loaded during initialization
  subscriptionData: {
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    trialEndDate: Date | null;
    isTrialEligible: boolean;
    isPremium: boolean;
    hasActiveSubscription: boolean;
    isTrialActive: boolean;
    daysRemainingInTrial: number;
  } | null;
  // Onboarding status
  onboardingCompleted: boolean;
  voiceOnboardingCompleted: boolean;
}

interface AppInitializationContextType extends AppInitializationState {
  markPhaseComplete: (phase: keyof InitializationPhase) => void;
  resetInitialization: () => void;
}

const AppInitializationContext = createContext<AppInitializationContextType | undefined>(undefined);

export function AppInitializationProvider({ children }: { children: ReactNode }) {
  const [phases, setPhases] = useState<InitializationPhase>({
    fonts: false,
    auth: false,
    onboarding: false,
    voiceOnboarding: false,
    appServices: false,
    subscription: false,
    contextProviders: false
  });

  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [voiceOnboardingCompleted, setVoiceOnboardingCompleted] = useState(false);

  const [subscriptionData, setSubscriptionData] = useState<{
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    trialEndDate: Date | null;
    isTrialEligible: boolean;
    isPremium: boolean;
    hasActiveSubscription: boolean;
    isTrialActive: boolean;
    daysRemainingInTrial: number;
  } | null>(null);

  const [currentPhase, setCurrentPhase] = useState<string>('Initializing fonts...');
  const [error, setError] = useState<string | null>(null);

  // Monitor font loading
  useEffect(() => {
    const checkFonts = () => {
      if ((window as any).__SOULO_FONTS_READY__) {
        markPhaseComplete('fonts');
        setCurrentPhase('Loading authentication...');
      }
    };

    // Check immediately in case fonts are already loaded
    checkFonts();

    // Listen for font ready event
    const handleFontsReady = () => {
      markPhaseComplete('fonts');
      setCurrentPhase('Loading authentication...');
    };

    window.addEventListener('fontsReady', handleFontsReady);
    
    // Fallback timeout to prevent hanging
    const fontTimeout = setTimeout(() => {
      if (!phases.fonts) {
        console.warn('[AppInit] Font loading timeout, proceeding anyway');
        markPhaseComplete('fonts');
        setCurrentPhase('Loading authentication...');
      }
    }, 3000);

    return () => {
      window.removeEventListener('fontsReady', handleFontsReady);
      clearTimeout(fontTimeout);
    };
  }, [phases.fonts]);

  // Monitor app services initialization
  const appInit = useAppInitialization();
  useEffect(() => {
    if (appInit.isInitialized && !appInit.error) {
      markPhaseComplete('appServices');
      setCurrentPhase('Finalizing setup...');
    } else if (appInit.error) {
      setError(appInit.error);
    }
  }, [appInit.isInitialized, appInit.error]);

  // Monitor auth state and onboarding status
  const { user, isLoading: authLoading, profileCreationInProgress, profileCreationComplete } = useAuth();
  
  useEffect(() => {
    if (!authLoading) {
      markPhaseComplete('auth');
      setCurrentPhase('Checking onboarding...');
    }
  }, [authLoading]);

  // Check onboarding status after auth is complete
  useEffect(() => {
    if (phases.auth && user) {
      checkOnboardingStatus();
    }
  }, [phases.auth, user]);

  const checkOnboardingStatus = async () => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed, voice_onboarding_completed')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking onboarding status:', error);
        // Default to incomplete onboarding
        setOnboardingCompleted(false);
        setVoiceOnboardingCompleted(false);
      } else {
        setOnboardingCompleted(profile?.onboarding_completed || false);
        setVoiceOnboardingCompleted(profile?.voice_onboarding_completed || false);
      }

      markPhaseComplete('onboarding');
      markPhaseComplete('voiceOnboarding');
      setCurrentPhase('Loading app services...');
    } catch (error) {
      console.error('Error checking onboarding:', error);
      setOnboardingCompleted(false);
      setVoiceOnboardingCompleted(false);
      markPhaseComplete('onboarding');
      markPhaseComplete('voiceOnboarding');
      setCurrentPhase('Loading app services...');
    }
  };

  // Load subscription data after app services are ready
  useEffect(() => {
    if (phases.appServices && !phases.subscription) {
      setCurrentPhase('Loading subscription data...');
      loadSubscriptionData();
    }
  }, [phases.appServices, phases.subscription, user]);

  const loadSubscriptionData = async () => {
    try {
      if (!user) {
        // No user - set default free tier
        setSubscriptionData({
          tier: 'free',
          status: 'free',
          trialEndDate: null,
          isTrialEligible: false,
          isPremium: false,
          hasActiveSubscription: false,
          isTrialActive: false,
          daysRemainingInTrial: 0
        });
        markPhaseComplete('subscription');
        setCurrentPhase('Finalizing setup...');
        return;
      }

      // Check if this is a new user
      if (profileCreationInProgress || (profileCreationComplete && !subscriptionData)) {
        console.log('[AppInit] New user detected - setting trial values');
        
        const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const newUserData = {
          tier: 'premium' as SubscriptionTier,
          status: 'trial' as SubscriptionStatus,
          trialEndDate: trialEnd,
          isTrialEligible: true,
          isPremium: true,
          hasActiveSubscription: true,
          isTrialActive: true,
          daysRemainingInTrial: 14
        };
        
        setSubscriptionData(newUserData);
        markPhaseComplete('subscription');
        setCurrentPhase('Finalizing setup...');
        
        // Sync with database in background
        setTimeout(() => {
          console.log('[AppInit] Syncing subscription with database...');
          fetchActualSubscriptionData();
        }, 100);
        
        return;
      }

      // Existing user - fetch from database
      await fetchActualSubscriptionData();
      
    } catch (error) {
      console.error('[AppInit] Error loading subscription:', error);
      
      // Set default values on error
      setSubscriptionData({
        tier: 'free',
        status: 'free',
        trialEndDate: null,
        isTrialEligible: false,
        isPremium: false,
        hasActiveSubscription: false,
        isTrialActive: false,
        daysRemainingInTrial: 0
      });
      
      markPhaseComplete('subscription');
      setCurrentPhase('Finalizing setup...');
    }
  };

  const fetchActualSubscriptionData = async () => {
    if (!user) return;

    try {
      // Cleanup expired trials first
      const { error: cleanupError } = await supabase.rpc('cleanup_expired_trials');
      if (cleanupError) {
        console.warn('[AppInit] Cleanup error:', cleanupError);
      }
      
      // Get subscription status
      const { data: statusData, error: statusError } = await supabase
        .rpc('get_user_subscription_status', {
          user_id_param: user.id
        });

      if (statusError) throw statusError;

      let tier: SubscriptionTier = 'free';
      let status: SubscriptionStatus = 'free';
      let trialEndDate: Date | null = null;
      let isTrialEligible = false;

      if (statusData && statusData.length > 0) {
        const data = statusData[0];
        tier = (data.current_tier === 'premium') ? 'premium' : 'free';
        status = (data.current_status as SubscriptionStatus) || 'free';
        trialEndDate = data.trial_end_date ? new Date(data.trial_end_date) : null;
      } else {
        // Fallback to profile query
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_tier, subscription_status, trial_ends_at, is_premium')
          .eq('id', user.id)
          .maybeSingle();

        if (!profileError && profileData) {
          tier = (profileData.subscription_tier === 'premium') ? 'premium' : 'free';
          status = (profileData.subscription_status as SubscriptionStatus) || 'free';
          trialEndDate = profileData.trial_ends_at ? new Date(profileData.trial_ends_at) : null;
        }
      }

      // Check trial eligibility
      const { data: eligibilityData, error: eligibilityError } = await supabase
        .rpc('is_trial_eligible', {
          user_id_param: user.id
        });

      if (!eligibilityError && eligibilityData !== null) {
        isTrialEligible = eligibilityData;
      }

      // Calculate derived values
      const isPremium = tier === 'premium';
      const isTrialActive = (status === 'trial' && tier === 'premium' && trialEndDate && trialEndDate > new Date());
      const hasActiveSubscription = status === 'active' || isTrialActive || (tier === 'premium' && status === 'trial');
      const daysRemainingInTrial = trialEndDate && isTrialActive
        ? Math.max(0, Math.ceil((trialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      setSubscriptionData({
        tier,
        status,
        trialEndDate,
        isTrialEligible,
        isPremium,
        hasActiveSubscription,
        isTrialActive,
        daysRemainingInTrial
      });

      console.log('[AppInit] Subscription data loaded:', {
        tier,
        status,
        trialEndDate,
        isTrialActive,
        isPremium,
        hasActiveSubscription
      });

    } catch (error) {
      console.error('[AppInit] Error fetching subscription:', error);
      subscriptionErrorHandler.handleError(error, 'Subscription');
    } finally {
      markPhaseComplete('subscription');
      setCurrentPhase('Finalizing setup...');
    }
  };

  // Mark context providers as ready after a brief delay to ensure all providers are mounted
  useEffect(() => {
    if (phases.fonts && phases.auth && phases.onboarding && phases.voiceOnboarding && phases.appServices && phases.subscription) {
      const timer = setTimeout(() => {
        markPhaseComplete('contextProviders');
        setCurrentPhase('Ready!');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [phases.fonts, phases.auth, phases.onboarding, phases.voiceOnboarding, phases.appServices, phases.subscription]);

  const markPhaseComplete = (phase: keyof InitializationPhase) => {
    setPhases(prev => ({ ...prev, [phase]: true }));
  };

  const resetInitialization = () => {
    setPhases({
      fonts: false,
      auth: false,
      onboarding: false,
      voiceOnboarding: false,
      appServices: false,
      subscription: false,
      contextProviders: false
    });
    setSubscriptionData(null);
    setOnboardingCompleted(false);
    setVoiceOnboardingCompleted(false);
    setCurrentPhase('Initializing fonts...');
    setError(null);
  };

  // Calculate progress
  const completedPhases = Object.values(phases).filter(Boolean).length;
  const totalPhases = Object.keys(phases).length;
  const progress = Math.round((completedPhases / totalPhases) * 100);

  // App is ready when all phases are complete
  const isAppReady = Object.values(phases).every(Boolean) && !error;

  const value: AppInitializationContextType = {
    isAppReady,
    phases,
    progress,
    currentPhase,
    error,
    subscriptionData,
    onboardingCompleted,
    voiceOnboardingCompleted,
    markPhaseComplete,
    resetInitialization
  };

  return (
    <AppInitializationContext.Provider value={value}>
      {children}
    </AppInitializationContext.Provider>
  );
}

export function useAppInitializationContext() {
  const context = useContext(AppInitializationContext);
  if (context === undefined) {
    throw new Error('useAppInitializationContext must be used within an AppInitializationProvider');
  }
  return context;
}