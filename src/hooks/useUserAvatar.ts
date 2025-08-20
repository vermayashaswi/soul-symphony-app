import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getOptimizedAvatarUrl, validateAvatarUrl, createRetryAvatarUrl } from '@/utils/avatarUtils';

interface UseUserAvatarReturn {
  avatarUrl: string | null;
  isLoading: boolean;
  error: string | null;
  refreshAvatar: () => Promise<void>;
  retry: () => Promise<void>;
}

export const useUserAvatar = (size: number = 192): UseUserAvatarReturn => {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const syncAvatarUrl = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setAvatarUrl(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First try to get from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      let sourceUrl = null;

      // Priority: profiles.avatar_url -> user_metadata.avatar_url
      if (profile?.avatar_url) {
        sourceUrl = profile.avatar_url;
      } else if (user.user_metadata?.avatar_url) {
        sourceUrl = user.user_metadata.avatar_url;
        
        // Sync to profiles table if missing
        await supabase
          .from('profiles')
          .update({ 
            avatar_url: sourceUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }

      if (!sourceUrl) {
        setAvatarUrl(null);
        return;
      }

      // Optimize and validate the URL
      const optimizedUrl = getOptimizedAvatarUrl(sourceUrl, size);
      
      if (optimizedUrl) {
        // Add retry parameters if needed
        const finalUrl = retryCount > 0 ? createRetryAvatarUrl(optimizedUrl, retryCount) : optimizedUrl;
        
        // Validate URL accessibility (only if not forced refresh to avoid excessive requests)
        if (!forceRefresh) {
          const isValid = await validateAvatarUrl(finalUrl);
          if (!isValid && retryCount < 3) {
            setRetryCount(prev => prev + 1);
            return;
          }
        }
        
        setAvatarUrl(finalUrl);
        setRetryCount(0); // Reset on success
      } else {
        setAvatarUrl(null);
        setError('Invalid avatar URL');
      }
    } catch (err: any) {
      console.error('[useUserAvatar] Error syncing avatar:', err);
      setError(err.message || 'Failed to load avatar');
      
      // Fallback to user metadata if profiles query fails
      if (user.user_metadata?.avatar_url) {
        const fallbackUrl = getOptimizedAvatarUrl(user.user_metadata.avatar_url, size);
        setAvatarUrl(fallbackUrl);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, size, retryCount]);

  const refreshAvatar = useCallback(async () => {
    if (!user) return;
    
    try {
      // Refresh user data from Supabase
      const { data: { user: refreshedUser } } = await supabase.auth.getUser();
      
      if (refreshedUser?.user_metadata?.avatar_url) {
        // Update profiles table with latest avatar
        await supabase
          .from('profiles')
          .update({ 
            avatar_url: refreshedUser.user_metadata.avatar_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
      
      // Force refresh avatar with new data
      await syncAvatarUrl(true);
    } catch (err: any) {
      console.error('[useUserAvatar] Error refreshing avatar:', err);
      setError('Failed to refresh avatar');
    }
  }, [user, syncAvatarUrl]);

  const retry = useCallback(async () => {
    setRetryCount(prev => prev + 1);
    await syncAvatarUrl();
  }, [syncAvatarUrl]);

  // Initial load and user change effect
  useEffect(() => {
    syncAvatarUrl();
  }, [syncAvatarUrl]);

  // Reset retry count when user changes
  useEffect(() => {
    setRetryCount(0);
    setError(null);
  }, [user?.id]);

  return {
    avatarUrl,
    isLoading,
    error,
    refreshAvatar,
    retry
  };
};