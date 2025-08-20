/**
 * Avatar Sync Service - Ensures avatar URLs are properly synchronized between auth and profiles
 */

import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { validateAvatarUrl, getOptimizedAvatarUrl } from '@/utils/avatarUtils';

interface AvatarSyncResult {
  success: boolean;
  avatarUrl?: string;
  error?: string;
}

class AvatarSyncService {
  private static instance: AvatarSyncService;

  private constructor() {}

  static getInstance(): AvatarSyncService {
    if (!AvatarSyncService.instance) {
      AvatarSyncService.instance = new AvatarSyncService();
    }
    return AvatarSyncService.instance;
  }

  /**
   * Ensures avatar URL is synced between auth metadata and profiles table
   */
  async syncUserAvatar(user: User): Promise<AvatarSyncResult> {
    if (!user) {
      return { success: false, error: 'No user provided' };
    }

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('[AvatarSync] Profile fetch error:', profileError);
      }

      const authAvatarUrl = user.user_metadata?.avatar_url;
      const profileAvatarUrl = profile?.avatar_url;

      // Determine the source of truth
      let finalAvatarUrl = null;

      if (authAvatarUrl && profileAvatarUrl) {
        // Both exist - prefer the more recent one or validate both
        const authValid = await this.validateUrl(authAvatarUrl);
        const profileValid = await this.validateUrl(profileAvatarUrl);

        if (authValid && profileValid) {
          // Use auth as source of truth for Google avatars
          finalAvatarUrl = authAvatarUrl;
        } else if (authValid) {
          finalAvatarUrl = authAvatarUrl;
        } else if (profileValid) {
          finalAvatarUrl = profileAvatarUrl;
        }
      } else if (authAvatarUrl) {
        finalAvatarUrl = authAvatarUrl;
      } else if (profileAvatarUrl) {
        finalAvatarUrl = profileAvatarUrl;
      }

      // Update profiles table if needed
      if (finalAvatarUrl && finalAvatarUrl !== profileAvatarUrl) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            avatar_url: finalAvatarUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.warn('[AvatarSync] Failed to update profile avatar:', updateError);
        }
      }

      return {
        success: true,
        avatarUrl: finalAvatarUrl || undefined
      };
    } catch (error: any) {
      console.error('[AvatarSync] Sync error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Refreshes avatar URL from auth provider
   */
  async refreshFromAuth(userId: string): Promise<AvatarSyncResult> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user || user.id !== userId) {
        return { success: false, error: 'Failed to get current user' };
      }

      return this.syncUserAvatar(user);
    } catch (error: any) {
      console.error('[AvatarSync] Refresh error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validates avatar URL with caching to avoid excessive requests
   */
  private async validateUrl(url: string): Promise<boolean> {
    if (!url) return false;

    try {
      // Quick validation for known good patterns
      if (url.includes('googleusercontent.com') || url.includes('gravatar.com')) {
        return true;
      }

      // For other URLs, do a quick validation
      return await validateAvatarUrl(url);
    } catch {
      return false;
    }
  }

  /**
   * Gets optimized avatar URL for a given size
   */
  getOptimizedUrl(avatarUrl: string | null, size: number = 192): string | null {
    if (!avatarUrl) return null;
    return getOptimizedAvatarUrl(avatarUrl, size);
  }
}

export const avatarSyncService = AvatarSyncService.getInstance();