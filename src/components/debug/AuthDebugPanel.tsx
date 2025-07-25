import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const AuthDebugPanel: React.FC = () => {
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [profileInfo, setProfileInfo] = useState<any>(null);
  const { session, user, isLoading } = useAuth();

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      setSessionInfo({ session: !!session, user: !!session?.user, error: error?.message });
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfileInfo(profile);
      }
    } catch (error) {
      setSessionInfo({ error: (error as Error).message });
    }
  };

  useEffect(() => {
    checkSession();
  }, [session]);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-background border rounded-lg p-4 max-w-sm text-xs">
      <h3 className="font-semibold mb-2">Auth Debug</h3>
      <div className="space-y-1">
        <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
        <div>Session: {session ? 'Yes' : 'No'}</div>
        <div>User: {user?.email || 'None'}</div>
        <div>Profile: {profileInfo?.onboarding_completed ? 'Complete' : 'Incomplete'}</div>
        <button 
          onClick={checkSession}
          className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs mt-2"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};