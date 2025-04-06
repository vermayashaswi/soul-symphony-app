
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
    console.log('[ProfileService] User metadata:', user.user_metadata);
    console.log('[ProfileService] Auth provider:', user.app_metadata?.provider);
    
    // First check if the profile already exists
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
      
    if (error) {
      if (error.code === 'PGRST116') { // Profile not found
        console.log('[ProfileService] Profile not found, creating new profile');
        
        // Extract user metadata - handle different metadata formats for different auth providers
        let fullName = '';
        let avatarUrl = '';
        const email = user.email || '';
        
        // Log all metadata to help debug
        console.log('[ProfileService] Full user metadata:', JSON.stringify(user.user_metadata, null, 2));
        
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
          avatar_url: avatarUrl, // Ensure this matches the column name exactly
          onboarding_completed: false,
          updated_at: new Date().toISOString()
        };
        
        console.log('[ProfileService] Creating profile with data:', profileData);
        
        // First, try upsert with explicit conflict handling
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert([profileData], { 
            onConflict: 'id',
            ignoreDuplicates: false
          });
            
        if (upsertError) {
          console.error('[ProfileService] Error upserting profile:', upsertError);
          
          // If upsert fails, try direct insert as fallback with simplified data
          console.log('[ProfileService] Attempting direct insert as fallback');
          const { error: insertError } = await supabase
            .from('profiles')
            .insert([{
              id: user.id,
              email,
              full_name: fullName,
              avatar_url: avatarUrl, // Ensure this matches exactly
              onboarding_completed: false
            }]);
            
          if (insertError) {
            console.error('[ProfileService] Final fallback insert failed:', insertError);
            
            // Another fallback with minimal data
            if (insertError.code === '23505') { // Duplicate key value violates unique constraint
              console.log('[ProfileService] Profile already exists but we got a not found error earlier. Weird state resolved.');
              return true;
            }
            
            return false;
          }
        }
        
        console.log('[ProfileService] Profile created successfully');
        return true;
      } else {
        console.error('[ProfileService] Error checking if profile exists:', error);
        return false;
      }
    }
    
    console.log('[ProfileService] Profile already exists:', data?.id);
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
      await supabase
        .from('profiles')
        .update({
          avatar_url: metadata.avatar_url, // Ensure field name matches
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    return true;
  } catch (error) {
    console.error('[ProfileService] Error updating profile:', error);
    return false;
  }
};
