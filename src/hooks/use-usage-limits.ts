
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

      // Get journal entries count - using the correct table name "Journal Entries"
      const { count: journalCount } = await supabase
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get chat messages count - simplified query to avoid type complexity
      const { data: userThreads } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('user_id', user.id);

      let chatCount = 0;
      if (userThreads && userThreads.length > 0) {
        const threadIds = userThreads.map(thread => thread.id);
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .in('thread_id', threadIds);
        chatCount = count || 0;
      }

      const journalUsage = {
        current: journalCount || 0,
        limit: FREE_TIER_LIMITS.journalEntries,
        percentage: Math.min(((journalCount || 0) / FREE_TIER_LIMITS.journalEntries) * 100, 100)
      };

      const chatUsage = {
        current: chatCount,
        limit: FREE_TIER_LIMITS.chatMessages,
        percentage: Math.min((chatCount / FREE_TIER_LIMITS.chatMessages) * 100, 100)
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
