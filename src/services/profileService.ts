
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Ensures a profile exists for the given user
 */
export const ensureProfileExists = async (user: User | null): Promise<boolean> => {
  if (!user) return false;
  
  try {
    console.log('Checking if profile exists for user:', user.id);
    
    // First check if the profile already exists
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('Profile not found, creating new profile');
        
        // Extract user metadata - handle different metadata formats (Google vs. Email)
        let fullName = '';
        let avatarUrl = '';
        const email = user.email || '';
        
        // Try different metadata paths for different auth providers
        if (user.user_metadata) {
          // Google auth often uses these fields
          fullName = user.user_metadata?.full_name || 
                    user.user_metadata?.name ||
                    `${user.user_metadata?.given_name || ''} ${user.user_metadata?.family_name || ''}`.trim();
          
          avatarUrl = user.user_metadata?.avatar_url || 
                     user.user_metadata?.picture || 
                     '';
        }
        
        console.log('Creating profile with data:', {
          id: user.id,
          email,
          full_name: fullName,
          avatar_url: avatarUrl
        });
        
        // Try upsert approach directly (handles both insert and update cases)
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert([{
            id: user.id,
            email,
            full_name: fullName,
            avatar_url: avatarUrl,
            onboarding_completed: false,
            updated_at: new Date().toISOString()
          }], { 
            onConflict: 'id',
            ignoreDuplicates: false 
          });
            
        if (upsertError) {
          console.error('Error upserting profile:', upsertError);
          
          // One more fallback attempt with a direct insert
          const { error: insertError } = await supabase
            .from('profiles')
            .insert([{
              id: user.id,
              email,
              full_name: fullName,
              avatar_url: avatarUrl,
              onboarding_completed: false
            }]);
            
          if (insertError) {
            console.error('Final fallback insert failed:', insertError);
            return false;
          }
        }
        
        console.log('Profile created successfully');
        return true;
      } else {
        console.error('Error checking if profile exists:', error);
        return false;
      }
    }
    
    console.log('Profile exists:', data.id);
    return true;
  } catch (error: any) {
    console.error('Error ensuring profile exists:', error);
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
