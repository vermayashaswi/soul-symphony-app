/**
 * Enhanced avatar management hook with unified data sources and debugging
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getOptimizedAvatarUrl } from '@/utils/avatarUtils';

export interface AvatarData {
  avatarUrl: string | null;
  source: 'user_metadata' | 'profile' | 'fallback';
  isLoading: boolean;
  error: string | null;
  debugInfo: {
    userMetadataUrl: string | null;
    profileUrl: string | null;
    optimizedUrl: string | null;
    lastUpdated: string;
  };
}

export interface AvatarManagerHooks {
  avatarData: AvatarData;
  refreshAvatar: () => Promise<void>;
  updateAvatarUrl: (url: string) => Promise<boolean>;
}

export const useAvatarManager = (): AvatarManagerHooks => {
  const { user } = useAuth();
  const [avatarData, setAvatarData] = useState<AvatarData>({
    avatarUrl: null,
    source: 'fallback',
    isLoading: true,
    error: null,
    debugInfo: {
      userMetadataUrl: null,
      profileUrl: null,
      optimizedUrl: null,
      lastUpdated: new Date().toISOString()
    }
  });

  const determineAvatarUrl = useCallback(async (): Promise<Partial<AvatarData>> => {
    if (!user) {
      return {
        avatarUrl: null,
        source: 'fallback',
        isLoading: false,
        error: null,
        debugInfo: {
          userMetadataUrl: null,
          profileUrl: null,
          optimizedUrl: null,
          lastUpdated: new Date().toISOString()
        }
      };
    }

    try {
      // Get avatar from user metadata (auth provider)
      const userMetadataUrl = user.user_metadata?.avatar_url || null;
      
      // Get avatar from profiles table
      let profileUrl: string | null = null;
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
        
        if (!profileError && profileData) {
          profileUrl = profileData.avatar_url;
        }
      } catch (profileErr) {
        console.warn('[AvatarManager] Profile avatar fetch failed:', profileErr);
      }

      // Priority logic: profile table > user metadata > fallback
      let finalUrl: string | null = null;
      let source: AvatarData['source'] = 'fallback';

      if (profileUrl) {
        finalUrl = profileUrl;
        source = 'profile';
      } else if (userMetadataUrl) {
        finalUrl = userMetadataUrl;
        source = 'user_metadata';
      }

      // Optimize the URL if available
      const optimizedUrl = finalUrl ? getOptimizedAvatarUrl(finalUrl, 192) : null;

      const debugInfo = {
        userMetadataUrl,
        profileUrl,
        optimizedUrl,
        lastUpdated: new Date().toISOString()
      };

      console.log('[AvatarManager] Avatar resolution:', {
        source,
        finalUrl,
        optimizedUrl,
        debugInfo
      });

      return {
        avatarUrl: optimizedUrl || finalUrl,
        source,
        isLoading: false,
        error: null,
        debugInfo
      };
    } catch (error) {
      console.error('[AvatarManager] Error determining avatar URL:', error);
      return {
        avatarUrl: null,
        source: 'fallback',
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        debugInfo: {
          userMetadataUrl: null,
          profileUrl: null,
          optimizedUrl: null,
          lastUpdated: new Date().toISOString()
        }
      };
    }
  }, [user]);

  const refreshAvatar = useCallback(async () => {
    setAvatarData(prev => ({ ...prev, isLoading: true, error: null }));
    
    const newAvatarData = await determineAvatarUrl();
    setAvatarData(prev => ({ ...prev, ...newAvatarData }));
  }, [determineAvatarUrl]);

  const updateAvatarUrl = useCallback(async (url: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Update both user metadata and profiles table for consistency
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { avatar_url: url }
      });

      if (metadataError) {
        console.error('[AvatarManager] Failed to update user metadata:', metadataError);
      }

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: url,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('[AvatarManager] Failed to update profile:', profileError);
        return false;
      }

      // Refresh avatar data to reflect changes
      await refreshAvatar();
      return true;
    } catch (error) {
      console.error('[AvatarManager] Error updating avatar URL:', error);
      setAvatarData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update avatar'
      }));
      return false;
    }
  }, [user, refreshAvatar]);

  // Initialize avatar data on mount and user change
  useEffect(() => {
    refreshAvatar();
  }, [refreshAvatar]);

  return {
    avatarData,
    refreshAvatar,
    updateAvatarUrl
  };
};