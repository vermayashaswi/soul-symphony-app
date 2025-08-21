/**
 * Service for managing timezone revalidation for existing users
 */

import { supabase } from '@/integrations/supabase/client';
import { needsTimezoneRevalidation, detectValidatedBrowserTimezone } from './timezoneService';

/**
 * Check if user's timezone needs updating and prompt if necessary
 */
export async function checkAndPromptTimezoneUpdate(userId: string): Promise<{
  needsUpdate: boolean;
  suggestedTimezone?: string;
  reason?: string;
}> {
  try {
    // Get current user profile timezone
    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single();

    if (!profile) {
      return { needsUpdate: false };
    }

    // Check if timezone needs revalidation
    const revalidation = needsTimezoneRevalidation(profile.timezone);
    
    if (revalidation.needsUpdate) {
      console.log('[timezoneRevalidationService] Timezone needs update:', revalidation);
      
      return {
        needsUpdate: true,
        suggestedTimezone: revalidation.suggestedTimezone,
        reason: revalidation.reason
      };
    }

    return { needsUpdate: false };
  } catch (error) {
    console.error('[timezoneRevalidationService] Error checking timezone:', error);
    return { needsUpdate: false };
  }
}

/**
 * Update user's timezone after validation
 */
export async function updateUserTimezone(userId: string, newTimezone: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        timezone: newTimezone,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('[timezoneRevalidationService] Error updating timezone:', error);
      return false;
    }

    console.log('[timezoneRevalidationService] Timezone updated successfully:', newTimezone);
    return true;
  } catch (error) {
    console.error('[timezoneRevalidationService] Exception updating timezone:', error);
    return false;
  }
}

/**
 * Batch revalidate timezones for multiple users (admin function)
 */
export async function batchRevalidateTimezones(userIds: string[]): Promise<{
  updated: number;
  errors: string[];
}> {
  let updated = 0;
  const errors: string[] = [];

  for (const userId of userIds) {
    try {
      const check = await checkAndPromptTimezoneUpdate(userId);
      
      if (check.needsUpdate && check.suggestedTimezone) {
        const success = await updateUserTimezone(userId, check.suggestedTimezone);
        if (success) {
          updated++;
        } else {
          errors.push(`Failed to update timezone for user ${userId}`);
        }
      }
    } catch (error) {
      errors.push(`Error processing user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { updated, errors };
}