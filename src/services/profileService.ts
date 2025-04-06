
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
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('Profile not found, creating new profile');
        
        // Extract user metadata for profile creation
        const fullName = user.user_metadata?.full_name || '';
        const avatarUrl = user.user_metadata?.avatar_url || '';
        
        console.log('Creating profile with data:', {
          id: user.id,
          email: user.email,
          full_name: fullName,
          avatar_url: avatarUrl
        });
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{
            id: user.id,
            email: user.email,
            full_name: fullName,
            avatar_url: avatarUrl,
            onboarding_completed: false
          }]);
          
        if (insertError) {
          console.error('Error creating profile:', insertError);
          toast.error('Failed to create your profile. Please try again.');
          return false;
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
    toast.error('Error setting up your profile. Please refresh and try again.');
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
