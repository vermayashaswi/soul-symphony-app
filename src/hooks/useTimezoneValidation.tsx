/**
 * Hook for timezone validation and user prompting
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { checkAndPromptTimezoneUpdate } from '@/services/timezoneRevalidationService';
import { useUserProfile } from './useUserProfile';

interface TimezoneValidationState {
  needsUpdate: boolean;
  suggestedTimezone: string | null;
  reason: string | null;
  isChecking: boolean;
  hasPrompted: boolean;
}

export const useTimezoneValidation = () => {
  const { user } = useAuth();
  const { timezone: userTimezone, updateTimezone } = useUserProfile();
  const [validationState, setValidationState] = useState<TimezoneValidationState>({
    needsUpdate: false,
    suggestedTimezone: null,
    reason: null,
    isChecking: false,
    hasPrompted: false
  });

  // Check timezone validation on user/timezone change
  useEffect(() => {
    const checkTimezoneValidation = async () => {
      if (!user || !userTimezone || validationState.hasPrompted) {
        return;
      }

      setValidationState(prev => ({ ...prev, isChecking: true }));

      try {
        const result = await checkAndPromptTimezoneUpdate(user.id);
        
        setValidationState({
          needsUpdate: result.needsUpdate,
          suggestedTimezone: result.suggestedTimezone || null,
          reason: result.reason || null,
          isChecking: false,
          hasPrompted: false
        });
      } catch (error) {
        console.error('[useTimezoneValidation] Error checking timezone:', error);
        setValidationState(prev => ({ 
          ...prev, 
          isChecking: false,
          needsUpdate: false
        }));
      }
    };

    // Only check after initial timezone is loaded
    if (userTimezone && userTimezone !== 'UTC') {
      checkTimezoneValidation();
    }
  }, [user, userTimezone, validationState.hasPrompted]);

  // Accept suggested timezone update
  const acceptTimezoneUpdate = async (): Promise<boolean> => {
    if (!validationState.suggestedTimezone) return false;

    try {
      await updateTimezone(validationState.suggestedTimezone);
      
      setValidationState(prev => ({
        ...prev,
        needsUpdate: false,
        hasPrompted: true
      }));
      
      console.log('[useTimezoneValidation] Timezone updated to:', validationState.suggestedTimezone);
      return true;
    } catch (error) {
      console.error('[useTimezoneValidation] Error updating timezone:', error);
      return false;
    }
  };

  // Dismiss the timezone update suggestion
  const dismissTimezoneUpdate = () => {
    setValidationState(prev => ({
      ...prev,
      needsUpdate: false,
      hasPrompted: true
    }));
    
    // Store dismissal in localStorage to avoid re-prompting this session
    if (user && validationState.suggestedTimezone) {
      localStorage.setItem(
        `timezone_dismissed_${user.id}`, 
        JSON.stringify({
          suggestedTimezone: validationState.suggestedTimezone,
          dismissedAt: new Date().toISOString()
        })
      );
    }
  };

  // Check if user has already dismissed this suggestion
  const hasDismissedSuggestion = (): boolean => {
    if (!user || !validationState.suggestedTimezone) return false;

    const dismissed = localStorage.getItem(`timezone_dismissed_${user.id}`);
    if (!dismissed) return false;

    try {
      const dismissData = JSON.parse(dismissed);
      // Check if the suggested timezone is the same and was dismissed within last 7 days
      const dismissedAt = new Date(dismissData.dismissedAt);
      const daysSinceDismissal = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      return dismissData.suggestedTimezone === validationState.suggestedTimezone && daysSinceDismissal < 7;
    } catch {
      return false;
    }
  };

  // Should show the timezone update prompt
  const shouldShowPrompt = validationState.needsUpdate && 
                          !validationState.hasPrompted && 
                          !hasDismissedSuggestion() &&
                          !validationState.isChecking;

  return {
    ...validationState,
    acceptTimezoneUpdate,
    dismissTimezoneUpdate,
    shouldShowPrompt
  };
};