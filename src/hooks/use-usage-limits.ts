
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from './use-subscription';

interface UsageLimits {
  journalEntries: {
    current: number;
    limit: number;
    percentage: number;
  };
  chatMessages: {
    current: number;
    limit: number;
    percentage: number;
  };
}

const FREE_TIER_LIMITS = {
  journalEntries: 50,
  chatMessages: 100
};

export function useUsageLimits() {
  const { user } = useAuth();
  const { subscriptionStatus } = useSubscription();
  const [usage, setUsage] = useState<UsageLimits>({
    journalEntries: { current: 0, limit: FREE_TIER_LIMITS.journalEntries, percentage: 0 },
    chatMessages: { current: 0, limit: FREE_TIER_LIMITS.chatMessages, percentage: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !subscriptionStatus.isActive && !subscriptionStatus.isInTrial) {
      fetchUsageData();
    } else {
      setLoading(false);
    }
  }, [user, subscriptionStatus]);

  const fetchUsageData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get journal entries count
      const { count: journalCount } = await supabase
        .from('journal_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get chat messages count
      const { count: chatCount } = await supabase
        .from('chat_messages')
        .select('cm.*, ct.user_id', { count: 'exact', head: true })
        .from('chat_messages as cm')
        .leftJoin('chat_threads as ct', 'cm.thread_id', 'ct.id')
        .eq('ct.user_id', user.id);

      const journalUsage = {
        current: journalCount || 0,
        limit: FREE_TIER_LIMITS.journalEntries,
        percentage: Math.min(((journalCount || 0) / FREE_TIER_LIMITS.journalEntries) * 100, 100)
      };

      const chatUsage = {
        current: chatCount || 0,
        limit: FREE_TIER_LIMITS.chatMessages,
        percentage: Math.min(((chatCount || 0) / FREE_TIER_LIMITS.chatMessages) * 100, 100)
      };

      setUsage({
        journalEntries: journalUsage,
        chatMessages: chatUsage
      });
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isApproachingLimit = (type: 'journalEntries' | 'chatMessages') => {
    return usage[type].percentage >= 80;
  };

  const hasReachedLimit = (type: 'journalEntries' | 'chatMessages') => {
    return usage[type].percentage >= 100;
  };

  const canUseFeature = (type: 'journalEntries' | 'chatMessages') => {
    // Always allow if premium or in trial
    if (subscriptionStatus.isActive || subscriptionStatus.isInTrial) {
      return true;
    }
    
    return !hasReachedLimit(type);
  };

  return {
    usage,
    loading,
    isApproachingLimit,
    hasReachedLimit,
    canUseFeature,
    refreshUsage: fetchUsageData
  };
}
