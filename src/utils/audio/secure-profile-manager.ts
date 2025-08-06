/**
 * Secure Profile Manager for Audio Processing
 * 
 * This utility provides profile management for audio processing with strict RLS enforcement.
 * It replaces the original profile-manager.ts with security-focused operations.
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Securely ensures that a user profile exists for the given user ID
 * Uses authenticated client with RLS enforcement
 */
export async function secureEnsureUserProfileExists(userId: string | undefined): Promise<boolean> {
  if (!userId) {
    console.error('No user ID provided');
    return false;
  }
  
  try {
    // Get the current authenticated user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.error('Error getting authenticated user:', userError);
      return false;
    }
    
    // Ensure the provided userId matches the authenticated user
    if (userData.user.id !== userId) {
      console.error('User ID mismatch - potential security violation');
      return false;
    }
    
    // RLS policies ensure user can only access their own profile
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
      
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error checking profile existence:', profileError);
      return false;
    }
    
    if (existingProfile) {
      console.log('User profile exists for authenticated user');
      
      // Check if user has existing journal entries for state management
      const { data: entries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
        
      const hasEntries = !entriesError && entries && entries.length > 0;
      console.log('User has previous entries:', hasEntries);
      
      // Update processing state (dynamic import to avoid circular dependencies)
      try {
        const { setHasPreviousEntries } = await import('./processing-state');
        setHasPreviousEntries(hasEntries);
      } catch (importError) {
        console.warn('Could not update processing state:', importError);
      }
      
      return true;
    }
    
    console.log('Profile does not exist for authenticated user');
    return false;
  } catch (error) {
    console.error('Error in secure profile existence check:', error);
    return false;
  }
}

/**
 * Securely checks user subscription status using RLS-enforced operations
 */
export async function secureCheckUserSubscription(userId: string): Promise<{ isPremium: boolean; status: string }> {
  if (!userId) {
    return { isPremium: false, status: 'unknown' };
  }
  
  try {
    // Get the current authenticated user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user || userData.user.id !== userId) {
      console.error('Authentication mismatch in subscription check');
      return { isPremium: false, status: 'unknown' };
    }
    
    // RLS policies ensure user can only access their own subscription status
    const { data: subscriptionData, error: subError } = await supabase
      .rpc('get_user_subscription_status', {
        user_id_param: userId
      });
      
    if (subError) {
      console.error('Error checking subscription status:', subError);
      return { isPremium: false, status: 'unknown' };
    }
    
    if (subscriptionData && subscriptionData.length > 0) {
      const status = subscriptionData[0];
      return {
        isPremium: status.is_premium_access || false,
        status: status.current_status || 'free'
      };
    }
    
    return { isPremium: false, status: 'free' };
  } catch (error) {
    console.error('Error in secure subscription check:', error);
    return { isPremium: false, status: 'unknown' };
  }
}