import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { User, Clock, Monitor } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';

export const UserDebugInfo: React.FC = () => {
  const [showDebug, setShowDebug] = useState(false);
  const { user } = useAuth();
  const { isPremium, isTrialActive, subscriptionStatus } = useSubscription();

  const debugInfo = {
    userId: user?.id,
    email: user?.email,
    displayName: user?.user_metadata?.full_name,
    avatarUrl: user?.user_metadata?.avatar_url,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    browserTimezone: new Date().getTimezoneOffset(),
    currentTime: new Date().toISOString(),
    localTime: new Date().toLocaleString(),
    subscription: { 
      isPremium, 
      isTrialActive, 
      subscriptionStatus 
    },
    userAgent: navigator.userAgent.substring(0, 100) + '...'
  };

  const handleDebugClick = () => {
    console.log('=== USER DEBUG INFO ===');
    console.table(debugInfo);
    console.log('Full user object:', user);
    console.log('========================');
    setShowDebug(!showDebug);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDebugClick}
        className="text-xs text-muted-foreground"
      >
        <User className="h-3 w-3 mr-1" />
        User Debug
      </Button>
      
      {showDebug && (
        <Card className="p-4 mt-4 bg-muted/30">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            User Debug Information
          </h4>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>User ID:</div>
              <div className="font-mono text-xs break-all">{debugInfo.userId || 'Not found'}</div>
              
              <div>Email:</div>
              <div className="font-mono">{debugInfo.email || 'Not found'}</div>
              
              <div>Display Name:</div>
              <div className="font-mono">{debugInfo.displayName || 'Not set'}</div>
              
              <div>Avatar URL:</div>
              <div className="font-mono text-xs break-all">
                {debugInfo.avatarUrl ? 'Found' : 'Not found'}
              </div>
              
              <div>Timezone:</div>
              <div className="font-mono">{debugInfo.timezone}</div>
              
              <div>UTC Offset:</div>
              <div className="font-mono">{debugInfo.browserTimezone} minutes</div>
              
              <div>Premium Status:</div>
              <div className="font-mono">{debugInfo.subscription.isPremium ? 'Yes' : 'No'}</div>
              
              <div>Trial Active:</div>
              <div className="font-mono">{debugInfo.subscription.isTrialActive ? 'Yes' : 'No'}</div>
              
              <div>Subscription:</div>
              <div className="font-mono">{debugInfo.subscription.subscriptionStatus}</div>
              
              <div>Local Time:</div>
              <div className="font-mono">{debugInfo.localTime}</div>
            </div>
            
            {debugInfo.avatarUrl && (
              <div className="mt-3 pt-2 border-t border-border">
                <div className="text-sm font-medium mb-2">Avatar URL Test:</div>
                <img 
                  src={debugInfo.avatarUrl} 
                  alt="Avatar test" 
                  className="w-12 h-12 rounded-full border"
                  onLoad={() => console.log('Avatar loaded successfully')}
                  onError={() => console.error('Avatar failed to load')}
                />
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  );
};