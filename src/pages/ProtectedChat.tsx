
import React from 'react';
import { useSubscriptionProtection } from '@/hooks/useSubscriptionProtection';
import Chat from './Chat';
import SubscriptionManager from '@/components/subscription/SubscriptionManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';

const ProtectedChat: React.FC = () => {
  const { hasAccess, isTrialActive, daysRemainingInTrial } = useSubscriptionProtection(true);

  if (!hasAccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-600" />
                Premium Feature
              </CardTitle>
              <CardDescription className="text-amber-700">
                Chat with AI requires a premium subscription to access personalized insights and guidance.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <SubscriptionManager />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isTrialActive && daysRemainingInTrial > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-700">
              You have {daysRemainingInTrial} days remaining in your free trial. Upgrade to continue accessing chat after your trial ends.
            </p>
          </CardContent>
        </Card>
      )}
      <Chat />
    </div>
  );
};

export default ProtectedChat;
