import { useCallback } from 'react';
import { useSessionTrackingContext } from '@/contexts/SessionTrackingContext';

/**
 * Hook for tracking user interactions in components
 * Provides simple methods to track button clicks, form submissions, etc.
 */
export const useInteractionTracking = () => {
  const { trackInteraction, trackPageInteraction } = useSessionTrackingContext();

  // Track button clicks
  const trackButtonClick = useCallback((buttonName?: string) => {
    trackInteraction(`button_click${buttonName ? `_${buttonName}` : ''}`);
  }, [trackInteraction]);

  // Track form submissions
  const trackFormSubmission = useCallback((formName?: string) => {
    trackInteraction(`form_submit${formName ? `_${formName}` : ''}`);
  }, [trackInteraction]);

  // Track link clicks
  const trackLinkClick = useCallback((linkText?: string) => {
    trackInteraction(`link_click${linkText ? `_${linkText}` : ''}`);
  }, [trackInteraction]);

  // Track modal or dialog interactions
  const trackModalAction = useCallback((action: 'open' | 'close', modalName?: string) => {
    trackInteraction(`modal_${action}${modalName ? `_${modalName}` : ''}`);
  }, [trackInteraction]);

  // Track voice recording actions
  const trackVoiceAction = useCallback((action: 'start' | 'stop' | 'play' | 'pause') => {
    trackInteraction(`voice_${action}`);
  }, [trackInteraction]);

  // Track navigation actions
  const trackNavigation = useCallback((destination: string) => {
    trackInteraction(`navigate_to_${destination}`);
  }, [trackInteraction]);

  // Track search actions
  const trackSearch = useCallback((searchType?: string) => {
    trackInteraction(`search${searchType ? `_${searchType}` : ''}`);
  }, [trackInteraction]);

  // Track settings changes
  const trackSettingsChange = useCallback((settingName: string) => {
    trackInteraction(`settings_change_${settingName}`);
  }, [trackInteraction]);

  // Generic interaction tracker
  const trackCustomInteraction = useCallback((actionName: string) => {
    trackInteraction(actionName);
  }, [trackInteraction]);

  return {
    trackButtonClick,
    trackFormSubmission,
    trackLinkClick,
    trackModalAction,
    trackVoiceAction,
    trackNavigation,
    trackSearch,
    trackSettingsChange,
    trackCustomInteraction,
    trackPageInteraction,
  };
};