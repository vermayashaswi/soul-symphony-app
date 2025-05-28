
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import { useMobile } from '@/hooks/use-mobile';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import JournalSummaryCard from '@/components/home/JournalSummaryCard';
import JournalContent from '@/components/home/JournalContent';
import JournalHeader from '@/components/home/JournalHeader';
import { InspirationalQuote } from '@/components/quotes/InspirationalQuote';
import EntityBubbles from '@/components/home/EntityBubbles';
import SubscriptionManager from '@/components/subscription/SubscriptionManager';
import { HomeErrorBoundary } from '@/components/home/HomeErrorBoundary';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, AlertCircle } from 'lucide-react';

const HomeContent = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { isMobile } = useMobile();
  const { data: journalEntries, isLoading: journalLoading, error: journalError } = useJournalEntries();
  
  const {
    isTrialActive,
    daysRemainingInTrial,
    shouldShowSubscriptionManager
  } = useSubscriptionStatus();

  console.log('Home page rendering:', { 
    hasUser: !!user,
    userId: user?.id,
    journalEntriesCount: journalEntries?.length,
    journalLoading,
    journalError: journalError?.message,
    authLoading,
    isTrialActive,
    shouldShowSubscriptionManager,
    currentPath: window.location.pathname
  });

  // Show loading state while auth is loading
  if (authLoading) {
    console.log('Home: Auth is loading, showing loading state');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    console.log('Home: No user found, showing sign-in message');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold">Welcome to Soulo</h1>
          <p className="text-muted-foreground">Please sign in to continue</p>
        </div>
      </div>
    );
  }

  // Always render the home content, even if there are journal errors
  // This ensures tutorial can overlay properly on the home page
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Show journal error if there's an issue, but don't stop rendering */}
        {journalError && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  Unable to load your journal data. Please try refreshing the page.
                </span>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Header - This is where tutorial will look for journal-header-container */}
        <HomeErrorBoundary>
          <JournalHeader />
        </HomeErrorBoundary>

        {/* Inspirational Quote */}
        <InspirationalQuote />

        {/* Journal Summary */}
        <JournalSummaryCard />

        {/* Entity Bubbles - show for all users */}
        <EntityBubbles entities={[]} />

        {/* Journal Content - Always render even if loading or error */}
        <JournalContent 
          entries={journalEntries || []} 
          isLoading={journalLoading}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
};

const Home = () => {
  console.log('Home wrapper component rendering');
  
  return (
    <HomeErrorBoundary>
      <HomeContent />
    </HomeErrorBoundary>
  );
};

export default Home;
