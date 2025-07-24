import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';

interface AuthDebugInfo {
  authState: {
    hasUser: boolean;
    userId: string | null;
    userEmail: string | null;
    profileExists: boolean | null;
  };
  supabaseSession: {
    hasSession: boolean;
    accessToken: string | null;
    refreshToken: string | null;
  };
  subscriptionState: {
    isPremium: boolean;
    isTrialActive: boolean;
    subscriptionStatus: string;
    tier: string;
    hasActiveSubscription: boolean;
  };
  rlsTest: {
    canQueryProfiles: boolean;
    canQueryJournalEntries: boolean;
    profileData: any;
    journalCount: number;
  };
}

export const AuthDebugComponent: React.FC = () => {
  const { user } = useAuth();
  const subscription = useSubscription();
  const [debugInfo, setDebugInfo] = useState<AuthDebugInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const gatherDebugInfo = async () => {
      console.log('[AuthDebug] Starting debug info collection');
      
      try {
        // Get current session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        // Test RLS access
        let canQueryProfiles = false;
        let canQueryJournalEntries = false;
        let profileData = null;
        let journalCount = 0;

        if (user?.id) {
          // Test profile access
          try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .maybeSingle();
            
            canQueryProfiles = !profileError;
            profileData = profile;
            console.log('[AuthDebug] Profile query result:', { canQueryProfiles, profile, error: profileError });
          } catch (error) {
            console.error('[AuthDebug] Profile query failed:', error);
          }

          // Test journal entries access
          try {
            const { data: entries, error: entriesError } = await supabase
              .from('Journal Entries')
              .select('id')
              .eq('user_id', user.id)
              .limit(5);
            
            canQueryJournalEntries = !entriesError;
            journalCount = entries?.length || 0;
            console.log('[AuthDebug] Journal query result:', { canQueryJournalEntries, count: journalCount, error: entriesError });
          } catch (error) {
            console.error('[AuthDebug] Journal query failed:', error);
          }
        }

        const info: AuthDebugInfo = {
          authState: {
            hasUser: !!user,
            userId: user?.id || null,
            userEmail: user?.email || null,
            profileExists: canQueryProfiles
          },
          supabaseSession: {
            hasSession: !!sessionData?.session,
            accessToken: sessionData?.session?.access_token ? 'present' : null,
            refreshToken: sessionData?.session?.refresh_token ? 'present' : null
          },
          subscriptionState: {
            isPremium: subscription.isPremium,
            isTrialActive: subscription.isTrialActive,
            subscriptionStatus: subscription.subscriptionStatus,
            tier: subscription.tier,
            hasActiveSubscription: subscription.hasActiveSubscription
          },
          rlsTest: {
            canQueryProfiles,
            canQueryJournalEntries,
            profileData,
            journalCount
          }
        };

        setDebugInfo(info);
        console.log('[AuthDebug] Complete debug info:', info);
      } catch (error) {
        console.error('[AuthDebug] Error gathering debug info:', error);
      } finally {
        setLoading(false);
      }
    };

    gatherDebugInfo();
  }, [user, subscription]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading debug info...</div>;
  }

  if (!debugInfo) {
    return <div className="text-sm text-red-500">Failed to load debug info</div>;
  }

  return (
    <Card className="p-4 mb-4 bg-red-50 border-red-200">
      <h3 className="font-bold text-red-800 mb-3">🐛 Auth Debug Info</h3>
      
      <div className="space-y-3 text-xs">
        <div>
          <strong>Auth State:</strong>
          <ul className="ml-4 space-y-1">
            <li>Has User: {debugInfo.authState.hasUser ? '✅' : '❌'}</li>
            <li>User ID: {debugInfo.authState.userId || 'null'}</li>
            <li>Email: {debugInfo.authState.userEmail || 'null'}</li>
            <li>Profile Exists: {debugInfo.authState.profileExists ? '✅' : '❌'}</li>
          </ul>
        </div>

        <div>
          <strong>Supabase Session:</strong>
          <ul className="ml-4 space-y-1">
            <li>Has Session: {debugInfo.supabaseSession.hasSession ? '✅' : '❌'}</li>
            <li>Access Token: {debugInfo.supabaseSession.accessToken ? '✅' : '❌'}</li>
            <li>Refresh Token: {debugInfo.supabaseSession.refreshToken ? '✅' : '❌'}</li>
          </ul>
        </div>

        <div>
          <strong>Subscription State:</strong>
          <ul className="ml-4 space-y-1">
            <li>Is Premium: {debugInfo.subscriptionState.isPremium ? '✅' : '❌'}</li>
            <li>Trial Active: {debugInfo.subscriptionState.isTrialActive ? '✅' : '❌'}</li>
            <li>Status: {debugInfo.subscriptionState.subscriptionStatus}</li>
            <li>Tier: {debugInfo.subscriptionState.tier}</li>
            <li>Has Active Sub: {debugInfo.subscriptionState.hasActiveSubscription ? '✅' : '❌'}</li>
          </ul>
        </div>

        <div>
          <strong>RLS Tests:</strong>
          <ul className="ml-4 space-y-1">
            <li>Can Query Profiles: {debugInfo.rlsTest.canQueryProfiles ? '✅' : '❌'}</li>
            <li>Can Query Journal: {debugInfo.rlsTest.canQueryJournalEntries ? '✅' : '❌'}</li>
            <li>Journal Count: {debugInfo.rlsTest.journalCount}</li>
            <li>Profile Data: {debugInfo.rlsTest.profileData ? 'Found' : 'None'}</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};