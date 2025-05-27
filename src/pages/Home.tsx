import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  MessageSquare, 
  LineChart, 
  Mic,
  Crown,
  Sparkles,
  Brain,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import JournalSummaryCard from '@/components/home/JournalSummaryCard';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useSubscription } from '@/hooks/use-subscription';
import { TrialCountdown } from '@/components/subscription/TrialCountdown';
import { FeatureDiscoveryCard } from '@/components/subscription/FeatureDiscoveryCard';
import { UsageLimitNotification } from '@/components/subscription/UsageLimitNotification';
import { ProactiveUpgradePrompt } from '@/components/subscription/ProactiveUpgradePrompt';
import { useSubscriptionPrompts } from '@/hooks/use-subscription-prompts';
import { useUsageLimits } from '@/hooks/use-usage-limits';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { entries, loading } = useJournalEntries();
  const { subscriptionStatus } = useSubscription();
  const { promptState, dismissPrompt } = useSubscriptionPrompts();
  const { isApproachingLimit, hasReachedLimit } = useUsageLimits();

  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  useEffect(() => {
    // Simulate a trigger for the upgrade prompt after a delay
    const timer = setTimeout(() => {
      setShowUpgradePrompt(true);
    }, 5000); // Show after 5 seconds

    return () => clearTimeout(timer);
  }, []); // Fixed: Added proper dependency array

  const recentEntries = entries?.slice(0, 3) || [];
  const totalEntries = entries?.length || 0;

  const premiumFeatures = [
    {
      name: "Advanced AI Insights",
      description: "Get deeper analysis of your emotional patterns and growth trends",
      benefits: [
        "Personalized recommendations",
        "Mood pattern recognition", 
        "Growth milestone tracking"
      ],
      icon: <Brain className="h-5 w-5 text-purple-600" />
    },
    {
      name: "Voice Recording",
      description: "Record your thoughts and have them automatically transcribed",
      benefits: [
        "Hands-free journaling",
        "Automatic transcription",
        "Emotion detection from voice"
      ],
      icon: <Mic className="h-5 w-5 text-blue-600" />
    },
    {
      name: "Unlimited Chat",
      description: "Have unlimited conversations with your AI wellness companion",
      benefits: [
        "24/7 emotional support",
        "Unlimited message history",
        "Advanced conversation context"
      ],
      icon: <MessageSquare className="h-5 w-5 text-green-600" />
    }
  ];

  return (
    <div className="min-h-screen pb-20 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center justify-center space-x-4">
            <h1 className="text-3xl font-bold">
              <TranslatableText text="Welcome back" />
              {user?.user_metadata?.name && `, ${user.user_metadata.name}`}
            </h1>
            {(subscriptionStatus.isActive || subscriptionStatus.isInTrial) && (
              <Badge className="bg-gradient-to-r from-purple-600 to-blue-600">
                <Crown className="h-3 w-3 mr-1" />
                {subscriptionStatus.isInTrial ? "Trial" : "Premium"}
              </Badge>
            )}
          </div>
          
          {/* Trial Countdown for home page */}
          {subscriptionStatus.isInTrial && (
            <TrialCountdown variant="full" showUpgradeButton={true} />
          )}
        </motion.div>

        {/* Usage Limit Notifications */}
        {isApproachingLimit('journalEntries') && (
          <UsageLimitNotification type="journalEntries" />
        )}
        {isApproachingLimit('chatMessages') && (
          <UsageLimitNotification type="chatMessages" />
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Card 
            className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
            onClick={() => navigate('/journal')}
          >
            <CardHeader className="text-center">
              <BookOpen className="h-8 w-8 mx-auto text-blue-600" />
              <CardTitle className="text-lg">
                <TranslatableText text="Journal" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-2xl font-bold">{totalEntries}</p>
              <p className="text-sm text-muted-foreground">
                <TranslatableText text="Total entries" />
              </p>
              {hasReachedLimit('journalEntries') && (
                <Badge variant="destructive" className="mt-2">
                  <TranslatableText text="Limit reached" />
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
            onClick={() => navigate('/chat')}
          >
            <CardHeader className="text-center">
              <MessageSquare className="h-8 w-8 mx-auto text-green-600" />
              <CardTitle className="text-lg">
                <TranslatableText text="Chat with Ruh" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="outline" className="w-full">
                <TranslatableText text="Start conversation" />
              </Button>
              {hasReachedLimit('chatMessages') && (
                <Badge variant="destructive" className="mt-2">
                  <TranslatableText text="Limit reached" />
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
            onClick={() => navigate('/insights')}
          >
            <CardHeader className="text-center">
              <LineChart className="h-8 w-8 mx-auto text-purple-600" />
              <CardTitle className="text-lg">
                <TranslatableText text="Insights" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="outline" className="w-full">
                <TranslatableText text="View insights" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Journal Entries */}
        {recentEntries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <JournalSummaryCard />
          </motion.div>
        )}

        {/* Feature Discovery - Show only for free users */}
        {!subscriptionStatus.isActive && !subscriptionStatus.isInTrial && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">
                <TranslatableText text="Unlock Premium Features" />
              </h2>
              <p className="text-muted-foreground">
                <TranslatableText text="Enhance your mental wellness journey with advanced AI-powered tools" />
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {premiumFeatures.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <FeatureDiscoveryCard feature={feature} context="home" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Proactive Upgrade Prompt */}
        {promptState.shouldShow && promptState.trigger && (
          <ProactiveUpgradePrompt
            trigger={promptState.trigger}
            onDismiss={() => dismissPrompt(promptState.trigger!)}
          />
        )}
      </div>
    </div>
  );
};

export default Home;
