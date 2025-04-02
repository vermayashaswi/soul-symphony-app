
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Simple interface for profile data
interface ProfileData {
  id: string;
  [key: string]: any;
}

export function useProfileCheck(userId: string | undefined) {
  const [isProfileChecked, setIsProfileChecked] = useState(false);

  useEffect(() => {
    if (userId) {
      checkUserProfile(userId);
    }
  }, [userId]);

  const checkUserProfile = async (userId: string) => {
    try {
      // Explicitly type the response to avoid deep type inference
      const profileResponse = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      const profile = profileResponse.data as ProfileData | null;
      const error = profileResponse.error;
      
      if (error || !profile) {
        console.log('Creating user profile...');
        
        const userResponse = await supabase.auth.getUser();
        const userData = userResponse.data;
        const userError = userResponse.error;
        
        if (userError) throw userError;
        
        const insertResponse = await supabase
          .from('profiles')
          .insert([{
            id: userId,
            email: userData.user?.email,
            full_name: userData.user?.user_metadata?.full_name || '',
            avatar_url: userData.user?.user_metadata?.avatar_url || ''
          }]);
          
        const insertError = insertResponse.error;
        if (insertError) throw insertError;
        
        console.log('Profile created successfully');
      }
      
      setIsProfileChecked(true);
    } catch (error: any) {
      console.error('Error checking/creating user profile:', error);
      toast.error('Error setting up profile. Please try again.');
    }
  };

  return { isProfileChecked };
}
