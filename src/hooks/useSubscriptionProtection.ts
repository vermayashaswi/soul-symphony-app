
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const useSubscriptionProtection = (requiresPremium: boolean = false) => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const location = useLocation();
  const navigate = useNavigate();

  const isPremium = profile?.is_premium || false;
  const subscriptionStatus = profile?.subscription_status || 'free';
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  
  // Check if trial has expired
  const isTrialExpired = trialEndsAt ? new Date() > trialEndsAt : false;
  const isTrialActive = subscriptionStatus === 'trial' && !isTrialExpired;
  
  // User has access if they're premium or trial is active
  const hasAccess = isPremium && (subscriptionStatus === 'active' || isTrialActive);

  useEffect(() => {
    if (requiresPremium && user && profile && !hasAccess) {
      // Show toast notification about premium requirement
      if (subscriptionStatus === 'trial' && isTrialExpired) {
        toast.error('Your free trial has expired. Upgrade to continue using premium features.');
      } else if (subscriptionStatus === 'free') {
        toast.error('This feature requires a premium subscription.');
      }
      
      // Redirect to home page with subscription manager
      navigate('/app/home', { replace: true });
    }
  }, [requiresPremium, user, profile, hasAccess, isTrialExpired, subscriptionStatus, navigate]);

  return {
    hasAccess,
    isPremium,
    isTrialActive,
    isTrialExpired,
    subscriptionStatus,
    trialEndsAt,
    daysRemainingInTrial: trialEndsAt && isTrialActive 
      ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0
  };
};
