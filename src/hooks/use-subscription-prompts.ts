
import { useState, useEffect } from 'react';
import { useSubscription } from './use-subscription';
import { useUsageLimits } from './use-usage-limits';

type PromptTrigger = 'positive_sentiment' | 'trial_expiring' | 'feature_usage' | 'streak_milestone';

interface PromptState {
  shouldShow: boolean;
  trigger: PromptTrigger | null;
  dismissed: string[];
}

export function useSubscriptionPrompts() {
  const { subscriptionStatus } = useSubscription();
  const { usage, isApproachingLimit } = useUsageLimits();
  const [promptState, setPromptState] = useState<PromptState>({
    shouldShow: false,
    trigger: null,
    dismissed: []
  });

  useEffect(() => {
    // Don't show prompts if already premium
    if (subscriptionStatus.isActive) return;

    checkForPromptTriggers();
  }, [subscriptionStatus, usage]);

  const checkForPromptTriggers = () => {
    const now = new Date();
    
    // Trial expiring soon
    if (subscriptionStatus.isInTrial && subscriptionStatus.trialEndsAt) {
      const trialEnd = new Date(subscriptionStatus.trialEndsAt);
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft <= 2 && !promptState.dismissed.includes('trial_expiring')) {
        setPromptState({
          shouldShow: true,
          trigger: 'trial_expiring',
          dismissed: promptState.dismissed
        });
        return;
      }
    }

    // Usage approaching limits
    if ((isApproachingLimit('journalEntries') || isApproachingLimit('chatMessages')) && 
        !promptState.dismissed.includes('feature_usage')) {
      setPromptState({
        shouldShow: true,
        trigger: 'feature_usage',
        dismissed: promptState.dismissed
      });
      return;
    }
  };

  const dismissPrompt = (trigger: PromptTrigger) => {
    setPromptState(prev => ({
      shouldShow: false,
      trigger: null,
      dismissed: [...prev.dismissed, trigger]
    }));
  };

  const triggerPositiveSentimentPrompt = () => {
    if (!promptState.dismissed.includes('positive_sentiment') && !subscriptionStatus.isActive) {
      setPromptState({
        shouldShow: true,
        trigger: 'positive_sentiment',
        dismissed: promptState.dismissed
      });
    }
  };

  const triggerStreakMilestonePrompt = () => {
    if (!promptState.dismissed.includes('streak_milestone') && !subscriptionStatus.isActive) {
      setPromptState({
        shouldShow: true,
        trigger: 'streak_milestone',
        dismissed: promptState.dismissed
      });
    }
  };

  return {
    promptState,
    dismissPrompt,
    triggerPositiveSentimentPrompt,
    triggerStreakMilestonePrompt
  };
}
