
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

export function useOnboarding() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isNativeReady, setIsNativeReady] = useState(false);

  const checkOnboardingStatus = async () => {
    try {
      console.log('[Onboarding] Checking onboarding status...', { hasUser: !!user });
      
      // For native apps, add stability check
      const isNative = typeof window !== 'undefined' && 
        (window.navigator?.userAgent?.includes('CapacitorWebView') || 
         window.location.protocol === 'capacitor:');
      
      if (isNative && !isNativeReady) {
        console.log('[Onboarding] Native app not ready yet, delaying check');
        setTimeout(() => {
          setIsNativeReady(true);
          checkOnboardingStatus();
        }, 200);
        return;
      }
      
      setLoading(true);
      
      // For authenticated users, check database first
      if (user) {
        console.log('[Onboarding] Checking status for authenticated user:', user.id);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed, display_name')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('[Onboarding] Error fetching profile:', error);
          // Fallback to localStorage
          const isComplete = localStorage.getItem('onboardingComplete') === 'true';
          setOnboardingComplete(isComplete);
        } else {
          console.log('[Onboarding] Profile data:', profile);
          setOnboardingComplete(profile.onboarding_completed || false);
          if (profile.display_name) {
            setDisplayName(profile.display_name);
          }
        }
      } else {
        // For unauthenticated users, use localStorage
        console.log('[Onboarding] Checking localStorage for unauthenticated user');
        const isComplete = localStorage.getItem('onboardingComplete') === 'true';
        setOnboardingComplete(isComplete);
        
        const name = localStorage.getItem('user_display_name');
        if (name) {
          setDisplayName(name);
        }
      }
    } catch (error) {
      console.error('[Onboarding] Error in checkOnboardingStatus:', error);
      // Fallback to localStorage
      const isComplete = localStorage.getItem('onboardingComplete') === 'true';
      setOnboardingComplete(isComplete);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Onboarding] Auth state changed:', event, { hasUser: !!session?.user });
      setUser(session?.user ?? null);
      
      // For native apps, mark as ready
      const isNative = typeof window !== 'undefined' && 
        (window.navigator?.userAgent?.includes('CapacitorWebView') || 
         window.location.protocol === 'capacitor:');
      
      if (isNative && !isNativeReady) {
        setTimeout(() => setIsNativeReady(true), 100);
      }
    });

    // Check initial auth state with native handling
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[Onboarding] Initial session check:', { hasUser: !!session?.user });
        setUser(session?.user ?? null);
        
        // For native apps, mark as ready
        const isNative = typeof window !== 'undefined' && 
          (window.navigator?.userAgent?.includes('CapacitorWebView') || 
           window.location.protocol === 'capacitor:');
        
        if (isNative) {
          setTimeout(() => setIsNativeReady(true), 100);
        } else {
          setIsNativeReady(true);
        }
      } catch (error) {
        console.error('[Onboarding] Error getting initial session:', error);
        setIsNativeReady(true);
      }
    };

    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  // Check onboarding status when user changes or native becomes ready
  useEffect(() => {
    if (isNativeReady) {
      checkOnboardingStatus();
    }
  }, [user, isNativeReady]);

  const completeOnboarding = async () => {
    try {
      localStorage.setItem('onboardingComplete', 'true');
      setOnboardingComplete(true);
      
      // Update database if user is authenticated
      if (user) {
        console.log('[Onboarding] Updating database onboarding status for user:', user.id);
        const { error } = await supabase
          .from('profiles')
          .update({ 
            onboarding_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (error) {
          console.error('[Onboarding] Error updating onboarding status:', error);
        } else {
          console.log('[Onboarding] Database updated successfully');
        }
      }
    } catch (error) {
      console.error('[Onboarding] Error in completeOnboarding:', error);
    }
  };

  const resetOnboarding = async () => {
    try {
      localStorage.removeItem('onboardingComplete');
      setOnboardingComplete(false);
      
      // Update database if user is authenticated
      if (user) {
        console.log('[Onboarding] Resetting database onboarding status for user:', user.id);
        const { error } = await supabase
          .from('profiles')
          .update({ 
            onboarding_completed: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (error) {
          console.error('[Onboarding] Error resetting onboarding status:', error);
        }
      }
    } catch (error) {
      console.error('[Onboarding] Error in resetOnboarding:', error);
    }
  };

  const saveNameToProfile = async (userId: string, name: string) => {
    if (!userId || !name) return;
    
    try {
      // Save the name to the profile
      const { error } = await supabase
        .from('profiles')
        .update({ 
          display_name: name,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (error) {
        console.error('Error saving display name to profile:', error);
      } else {
        // Clear from localStorage after successful save
        localStorage.removeItem('user_display_name');
      }
    } catch (error) {
      console.error('Error in saving display name:', error);
    }
  };

  return {
    onboardingComplete,
    loading,
    displayName,
    user,
    completeOnboarding,
    resetOnboarding,
    saveNameToProfile,
    checkOnboardingStatus
  };
}
