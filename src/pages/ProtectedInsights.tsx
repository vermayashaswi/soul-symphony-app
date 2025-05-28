
import React from 'react';
import { useSubscriptionProtection } from '@/hooks/useSubscriptionProtection';
import Insights from './Insights';
import SubscriptionManager from '@/components/subscription/SubscriptionManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';

const ProtectedInsights: React.FC = () => {
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
                Insights require a premium subscription to unlock detailed analytics about your journal entries.
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
              You have {daysRemainingInTrial} days remaining in your free trial. Upgrade to continue accessing insights after your trial ends.
            </p>
          </CardContent>
        </Card>
      )}
      <Insights />
    </div>
  );
};

export default ProtectedInsights;
