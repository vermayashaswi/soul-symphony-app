
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import { useMobile } from '@/hooks/use-mobile';
import JournalSummaryCard from '@/components/home/JournalSummaryCard';
import JournalContent from '@/components/home/JournalContent';
import JournalHeader from '@/components/home/JournalHeader';
import { InspirationalQuote } from '@/components/quotes/InspirationalQuote';
import EntityBubbles from '@/components/home/EntityBubbles';
import SubscriptionManager from '@/components/subscription/SubscriptionManager';
import { Card, CardContent } from '@/components/ui/card';
import { Crown } from 'lucide-react';

const Home = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { isMobile } = useMobile();
  const { data: journalEntries = [], isLoading } = useJournalEntries();

  // Check subscription status
  const subscriptionStatus = profile?.subscription_status || 'free';
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const isTrialExpired = trialEndsAt ? new Date() > trialEndsAt : false;
  const isTrialActive = subscriptionStatus === 'trial' && !isTrialExpired;
  const isPremium = profile?.is_premium && (subscriptionStatus === 'active' || isTrialActive);

  const daysRemainingInTrial = trialEndsAt && isTrialActive 
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  // Show subscription manager if user needs to upgrade
  const shouldShowSubscriptionManager = !isPremium || (isTrialActive && daysRemainingInTrial <= 3);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold">Welcome to Soulo</h1>
          <p className="text-muted-foreground">Please sign in to continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Subscription Status Card */}
        {isTrialActive && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Free Trial Active - {daysRemainingInTrial} days remaining
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscription Manager - show if needed */}
        {shouldShowSubscriptionManager && (
          <SubscriptionManager className="mb-6" />
        )}

        {/* Header */}
        <JournalHeader />

        {/* Inspirational Quote */}
        <InspirationalQuote />

        {/* Journal Summary */}
        <JournalSummaryCard />

        {/* Entity Bubbles - show for all users */}
        <EntityBubbles />

        {/* Journal Content */}
        <JournalContent 
          entries={journalEntries} 
          isLoading={isLoading}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
};

export default Home;
