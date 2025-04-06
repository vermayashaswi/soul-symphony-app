
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Ensures a profile exists for the given user
 */
export const ensureProfileExists = async (user: User | null): Promise<boolean> => {
  if (!user) {
    console.log('[ProfileService] Cannot create profile: No user provided');
    return false;
  }
  
  try {
    console.log('[ProfileService] Checking if profile exists for user:', user.id);
    
    // First check if the profile already exists - use maybeSingle to prevent errors if not found
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
      
    if (error && error.code !== 'PGRST116') {
      console.error('[ProfileService] Error checking if profile exists:', error);
      return false;
    }
    
    // If profile already exists, return true immediately
    if (data) {
      console.log('[ProfileService] Profile already exists:', data.id);
      return true;
    }
    
    console.log('[ProfileService] Profile not found, creating new profile');
    
    // Extract user metadata - handle different metadata formats for different auth providers
    let fullName = '';
    let avatarUrl = '';
    const email = user.email || '';
    
    // Log all metadata to help debug
    console.log('[ProfileService] User metadata:', user.user_metadata);
    console.log('[ProfileService] Auth provider:', user.app_metadata?.provider);
    
    // Handle different authentication providers' metadata formats
    if (user.app_metadata?.provider === 'google') {
      // Google specific metadata extraction
      fullName = user.user_metadata?.name || 
                user.user_metadata?.full_name ||
                `${user.user_metadata?.given_name || ''} ${user.user_metadata?.family_name || ''}`.trim();
      
      avatarUrl = user.user_metadata?.picture || 
                 user.user_metadata?.avatar_url || 
                 '';
      
      console.log('[ProfileService] Extracted Google metadata:', { fullName, avatarUrl });
    } else {
      // Default metadata extraction for email or other providers
      fullName = user.user_metadata?.full_name || 
                user.user_metadata?.name ||
                `${user.user_metadata?.given_name || ''} ${user.user_metadata?.family_name || ''}`.trim();
      
      avatarUrl = user.user_metadata?.avatar_url || 
                 user.user_metadata?.picture || 
                 '';
                 
      console.log('[ProfileService] Extracted default metadata:', { fullName, avatarUrl });
    }
    
    // Explicit profile data preparation - ensure field names match exactly with the database schema
    const profileData = {
      id: user.id,
      email,
      full_name: fullName,
      avatar_url: avatarUrl, 
      onboarding_completed: false,
      updated_at: new Date().toISOString()
    };
    
    console.log('[ProfileService] Creating profile with data:', profileData);
    
    // Try upsert with explicit conflict handling
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert([profileData], { 
        onConflict: 'id',
        ignoreDuplicates: false
      });
        
    if (upsertError) {
      console.error('[ProfileService] Error upserting profile:', upsertError);
      
      // If error code is for a duplicate, that means the profile actually exists
      if (upsertError.code === '23505') { // Duplicate key value violates unique constraint
        console.log('[ProfileService] Profile already exists (detected via constraint error)');
        return true;
      }
      
      return false;
    }
    
    console.log('[ProfileService] Profile created successfully');
    return true;
  } catch (error: any) {
    console.error('[ProfileService] Error ensuring profile exists:', error);
    return false;
  }
};

/**
 * Updates the user profile metadata
 */
export const updateUserProfile = async (user: User | null, metadata: Record<string, any>): Promise<boolean> => {
  if (!user) return false;
  
  try {
    const { data, error } = await supabase.auth.updateUser({
      data: metadata,
    });

    if (error) {
      throw error;
    }

    if (user.id) {
      // Ensure avatar_url is updated in the profiles table too
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          avatar_url: metadata.avatar_url, // Ensure field name matches
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
        
      if (profileError) {
        console.error('[ProfileService] Error updating profile table:', profileError);
      }
    }

    return true;
  } catch (error) {
    console.error('[ProfileService] Error updating profile:', error);
    return false;
  }
};
