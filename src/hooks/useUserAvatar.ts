import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getOptimizedAvatarUrl, validateAvatarUrl, createRetryAvatarUrl } from '@/utils/avatarUtils';
import { Capacitor } from '@capacitor/core';

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

  // Enhanced avatar caching
  const getCachedAvatarUrl = useCallback(() => {
    if (!user?.id) return null;
    try {
      const cached = localStorage.getItem(`avatar_cache_${user.id}`);
      if (cached) {
        const { url, timestamp } = JSON.parse(cached);
        // Cache valid for 1 hour
        if (Date.now() - timestamp < 3600000) {
          console.log('[useUserAvatar] Using cached avatar URL:', url);
          return url;
        }
      }
    } catch (error) {
      console.warn('[useUserAvatar] Failed to read cached avatar:', error);
    }
    return null;
  }, [user?.id]);

  const setCachedAvatarUrl = useCallback((url: string | null) => {
    if (!user?.id || !url) return;
    try {
      localStorage.setItem(`avatar_cache_${user.id}`, JSON.stringify({
        url,
        timestamp: Date.now()
      }));
      console.log('[useUserAvatar] Cached avatar URL:', url);
    } catch (error) {
      console.warn('[useUserAvatar] Failed to cache avatar:', error);
    }
  }, [user?.id]);

  const syncAvatarUrl = useCallback(async (forceRefresh = false) => {
    const isNative = Capacitor.isNativePlatform();
    console.log('[useUserAvatar] Starting sync - Native:', isNative, 'Force:', forceRefresh, 'User:', user?.id);
    
    if (!user) {
      setAvatarUrl(null);
      setError(null);
      return;
    }

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = getCachedAvatarUrl();
      if (cached) {
        setAvatarUrl(cached);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[useUserAvatar] Fetching profile data...');
      
      // First try to get from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('[useUserAvatar] Profile query error:', profileError);
      }

      let sourceUrl = null;
      let urlSource = '';

      // Priority: profiles.avatar_url -> user_metadata.avatar_url -> fallback
      if (profile?.avatar_url) {
        sourceUrl = profile.avatar_url;
        urlSource = 'profiles';
        console.log('[useUserAvatar] Using profile avatar URL:', sourceUrl);
      } else if (user.user_metadata?.avatar_url) {
        sourceUrl = user.user_metadata.avatar_url;
        urlSource = 'auth_metadata';
        console.log('[useUserAvatar] Using auth metadata avatar URL:', sourceUrl);
        
        // Sync to profiles table if missing (but don't wait for it)
        supabase
          .from('profiles')
          .update({ 
            avatar_url: sourceUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) console.warn('[useUserAvatar] Failed to sync to profiles:', error);
            else console.log('[useUserAvatar] Synced avatar to profiles table');
          });
      }

      if (!sourceUrl) {
        console.log('[useUserAvatar] No avatar URL found');
        setAvatarUrl(null);
        return;
      }

      // Optimize the URL
      const optimizedUrl = getOptimizedAvatarUrl(sourceUrl, size);
      console.log('[useUserAvatar] Optimized URL:', optimizedUrl, 'from:', urlSource);
      
      if (optimizedUrl) {
        // Add retry parameters if needed
        const finalUrl = retryCount > 0 ? createRetryAvatarUrl(optimizedUrl, retryCount) : optimizedUrl;
        console.log('[useUserAvatar] Final URL (retry count:', retryCount, '):', finalUrl);
        
        // For native platforms, use lighter validation to avoid network issues
        if (!forceRefresh && !isNative) {
          console.log('[useUserAvatar] Validating URL accessibility...');
          const isValid = await validateAvatarUrl(finalUrl);
          if (!isValid && retryCount < 3) {
            console.warn('[useUserAvatar] URL validation failed, retrying...');
            setRetryCount(prev => prev + 1);
            return;
          }
          console.log('[useUserAvatar] URL validation result:', isValid);
        }
        
        setAvatarUrl(finalUrl);
        setCachedAvatarUrl(finalUrl);
        setRetryCount(0); // Reset on success
        console.log('[useUserAvatar] Avatar URL set successfully');
      } else {
        console.warn('[useUserAvatar] Failed to optimize avatar URL');
        setAvatarUrl(null);
        setError('Invalid avatar URL');
      }
    } catch (err: any) {
      console.error('[useUserAvatar] Error syncing avatar:', err);
      setError(err.message || 'Failed to load avatar');
      
      // Enhanced fallback strategy
      if (user.user_metadata?.avatar_url) {
        console.log('[useUserAvatar] Attempting fallback to user metadata');
        const fallbackUrl = getOptimizedAvatarUrl(user.user_metadata.avatar_url, size);
        if (fallbackUrl) {
          setAvatarUrl(fallbackUrl);
          setCachedAvatarUrl(fallbackUrl);
          console.log('[useUserAvatar] Fallback URL set:', fallbackUrl);
        }
      }
    } finally {
      setIsLoading(false);
      console.log('[useUserAvatar] Sync complete');
    }
  }, [user, size, retryCount, getCachedAvatarUrl, setCachedAvatarUrl]);

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