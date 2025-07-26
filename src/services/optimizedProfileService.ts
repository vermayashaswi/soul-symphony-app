import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

/**
 * Optimized Profile Service
 * Uses the new optimized database functions for better performance
 */

export interface ProfileCreationResult {
  success: boolean;
  action?: 'profile_exists' | 'profile_created' | 'profile_exists_concurrent';
  profile_id?: string;
  trial_ends_at?: string;
  error?: string;
}

export const optimizedProfileService = {
  /**
   * Create or verify user profile using fallback to direct table operations
   * Note: The optimized function will be available after migration deployment
   */
  async createOrVerifyProfile(user: User): Promise<ProfileCreationResult> {
    try {
      // First check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id, subscription_status, is_premium')
        .eq('id', user.id)
        .maybeSingle();

      if (checkError) {
        console.error('[OptimizedProfileService] Error checking profile:', checkError);
        return { success: false, error: checkError.message };
      }

      if (existingProfile) {
        return {
          success: true,
          action: 'profile_exists',
          profile_id: existingProfile.id
        };
      }

      // Create new profile
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          subscription_status: 'trial',
          subscription_tier: 'premium',
          is_premium: true,
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          onboarding_completed: false
        })
        .select('id, trial_ends_at')
        .single();

      if (createError) {
        if (createError.code === '23505') { // Unique violation - profile created concurrently
          return {
            success: true,
            action: 'profile_exists_concurrent',
            profile_id: user.id
          };
        }
        console.error('[OptimizedProfileService] Error creating profile:', createError);
        return { success: false, error: createError.message };
      }

      return {
        success: true,
        action: 'profile_created',
        profile_id: newProfile.id,
        trial_ends_at: newProfile.trial_ends_at
      };
    } catch (error: any) {
      console.error('[OptimizedProfileService] Exception creating profile:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get subscription status using optimized function
   */
  async getSubscriptionStatus(userId: string) {
    try {
      const { data, error } = await supabase.rpc('get_user_subscription_status', {
        user_id_param: userId
      });

      if (error) {
        console.error('[OptimizedProfileService] Error getting subscription status:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error: any) {
      console.error('[OptimizedProfileService] Exception getting subscription status:', error);
      return null;
    }
  },

  /**
   * Check trial eligibility using optimized function
   */
  async checkTrialEligibility(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_trial_eligible', {
        user_id_param: userId
      });

      if (error) {
        console.error('[OptimizedProfileService] Error checking trial eligibility:', error);
        return false;
      }

      return data || false;
    } catch (error: any) {
      console.error('[OptimizedProfileService] Exception checking trial eligibility:', error);
      return false;
    }
  },

  /**
   * Cleanup expired trials
   */
  async cleanupExpiredTrials(): Promise<void> {
    try {
      const { error } = await supabase.rpc('cleanup_expired_trials');
      if (error) {
        console.warn('[OptimizedProfileService] Error cleaning up expired trials:', error);
      }
    } catch (error: any) {
      console.warn('[OptimizedProfileService] Exception cleaning up expired trials:', error);
    }
  }
};