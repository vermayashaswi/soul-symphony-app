
import { supabase } from '@/integrations/supabase/client';

export const handleAuthCallback = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Auth callback error:', error);
      return null;
    }

    // Clean up hash fragment from URL after OAuth callback
    if (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('#'))) {
      console.log('Cleaning up OAuth hash fragment from URL');
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    return data.session;
  } catch (error) {
    console.error('Error handling auth callback:', error);
    return null;
  }
};

export const signInWithGoogle = async () => {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app/home`
      }
    });

    if (error) throw error;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
  } catch (error) {
    console.error('Email sign-in error:', error);
    throw error;
  }
};

export const signUp = async (email: string, password: string) => {
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) throw error;
  } catch (error) {
    console.error('Sign-up error:', error);
    throw error;
  }
};

export const resetPassword = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) throw error;
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
};
