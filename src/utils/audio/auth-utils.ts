
import { supabase } from '@/integrations/supabase/client';

export async function verifyUserAuthentication() {
  // Get the current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('Error checking authentication:', sessionError);
    return { isAuthenticated: false, userId: null, error: 'Session error: ' + sessionError.message };
  }
  
  if (!session || !session.user) {
    return { isAuthenticated: false, userId: null, error: 'You must be signed in' };
  }
  
  return { isAuthenticated: true, userId: session.user.id, error: null };
}

export async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}
