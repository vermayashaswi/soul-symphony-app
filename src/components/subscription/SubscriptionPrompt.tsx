
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, MessageCircle, TrendingUp, Crown } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface SubscriptionPromptProps {
  feature: string;
}

const featureConfig = {
  chat: {
    icon: MessageCircle,
    title: 'Smart AI Chat',
    description: 'Get personalized insights and guidance through our advanced AI chat feature',
    benefits: [
      'Personalized mental health insights',
      'AI-powered emotional support',
      'Deep analysis of your journal entries',
      'Intelligent conversation with your data'
    ]
  },
  'advanced-insights': {
    icon: TrendingUp,
    title: 'Advanced Insights',
    description: 'Unlock detailed analytics and patterns in your emotional journey',
    benefits: [
      'Comprehensive mood tracking',
      'Emotion pattern analysis',
      'Personalized recommendations',
      'Advanced visualizations'
    ]
  },
  soulnet: {
    icon: Sparkles,
    title: 'SoulNet Visualization',
    description: 'Explore your emotional connections with our 3D network visualization',
    benefits: [
      'Interactive 3D emotion mapping',
      'Connection pattern discovery',
      'Visual emotional journey',
      'Unique insight perspectives'
    ]
  }
};

export const SubscriptionPrompt: React.FC<SubscriptionPromptProps> = ({ feature }) => {
  const { isTrialActive, trialDaysRemaining, isPremium } = useSubscription();
  
  const config = featureConfig[feature as keyof typeof featureConfig] || featureConfig.chat;
  const Icon = config.icon;

  const handleUpgrade = () => {
    // TODO: Navigate to subscription page or open upgrade modal
    console.log('Navigate to subscription upgrade');
  };

  const handleStartTrial = () => {
    // TODO: Start trial flow
    console.log('Start trial flow');
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {config.title}
          </CardTitle>
          <CardDescription className="text-lg">
            {config.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3">
            {config.benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </div>

          {isTrialActive ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-blue-800 font-medium">
                🎉 Your trial is active! {trialDaysRemaining} days remaining
              </p>
              <p className="text-blue-600 text-sm mt-1">
                Enjoy full access to all premium features
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 text-center">
                <p className="font-medium text-primary">
                  ✨ Start your 7-day free trial
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Full access to all premium features, cancel anytime
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={handleStartTrial}
                  className="flex-1"
                  size="lg"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Free Trial
                </Button>
                <Button 
                  onClick={handleUpgrade}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  View Plans
                </Button>
              </div>
            </div>
          )}

          <div className="text-center text-xs text-muted-foreground">
            <p>Cancel anytime • No hidden fees • Secure payments</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
