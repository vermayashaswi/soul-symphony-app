
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Ensures a profile exists for the given user
 */
export const ensureProfileExists = async (user: User | null): Promise<boolean> => {
  if (!user) {
    console.log('Cannot create profile: No user provided');
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
        
        // Try different metadata paths for different auth providers
        if (user.user_metadata) {
          // Google auth uses these fields
          if (user.app_metadata?.provider === 'google') {
            console.log('[ProfileService] Extracting Google-specific metadata');
            fullName = user.user_metadata?.name || 
                      user.user_metadata?.full_name ||
                      `${user.user_metadata?.given_name || ''} ${user.user_metadata?.family_name || ''}`.trim();
            
            avatarUrl = user.user_metadata?.picture || 
                       user.user_metadata?.avatar_url || 
                       '';
          } else {
            // Email auth or other providers
            fullName = user.user_metadata?.full_name || 
                      user.user_metadata?.name ||
                      `${user.user_metadata?.given_name || ''} ${user.user_metadata?.family_name || ''}`.trim();
            
            avatarUrl = user.user_metadata?.avatar_url || 
                       user.user_metadata?.picture || 
                       '';
          }
        }
        
        console.log('[ProfileService] Creating profile with data:', {
          id: user.id,
          email,
          full_name: fullName,
          avatar_url: avatarUrl
        });
        
        // Explicit handling for different auth providers
        const profileData = {
          id: user.id,
          email,
          full_name: fullName,
          avatar_url: avatarUrl,
          onboarding_completed: false,
          updated_at: new Date().toISOString()
        };
        
        // First, try upsert with explicit conflict handling
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert([profileData], { 
            onConflict: 'id',
            ignoreDuplicates: false
          });
            
        if (upsertError) {
          console.error('[ProfileService] Error upserting profile:', upsertError);
          
          // If upsert fails, try direct insert as fallback
          console.log('[ProfileService] Attempting direct insert as fallback');
          const { error: insertError } = await supabase
            .from('profiles')
            .insert([profileData]);
            
          if (insertError) {
            console.error('[ProfileService] Final fallback insert failed:', insertError);
            
            // Last resort - try without updated_at field which might cause issues
            console.log('[ProfileService] Trying simplified insert without updated_at');
            const { error: finalError } = await supabase
              .from('profiles')
              .insert([{
                id: user.id,
                email,
                full_name: fullName,
                avatar_url: avatarUrl,
                onboarding_completed: false
              }]);
              
            if (finalError) {
              console.error('[ProfileService] All insert attempts failed:', finalError);
              return false;
            }
          }
        }
        
        console.log('[ProfileService] Profile created successfully');
        return true;
      } else {
        console.error('[ProfileService] Error checking if profile exists:', error);
        return false;
      }
    }
    
    console.log('[ProfileService] Profile already exists:', data.id);
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
          avatar_url: metadata.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    return true;
  } catch (error) {
    console.error('Error updating profile:', error);
    return false;
  }
};
