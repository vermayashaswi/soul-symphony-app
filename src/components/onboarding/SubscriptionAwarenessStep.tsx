
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Check, Sparkles, ArrowRight } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useSubscription } from '@/hooks/use-subscription';

interface SubscriptionAwarenessStepProps {
  onContinue: () => void;
  onStartTrial?: () => void;
}

export function SubscriptionAwarenessStep({ onContinue, onStartTrial }: SubscriptionAwarenessStepProps) {
  const { startFreeTrial, loading } = useSubscription();
  const [trialStarting, setTrialStarting] = useState(false);

  const handleStartTrial = async () => {
    try {
      setTrialStarting(true);
      await startFreeTrial();
      onStartTrial?.();
    } catch (error) {
      console.error('Failed to start trial:', error);
    } finally {
      setTrialStarting(false);
    }
  };

  const features = [
    "Unlimited journal entries",
    "Advanced AI insights & analysis", 
    "Voice recording & transcription",
    "Unlimited chat with your AI companion",
    "Detailed mood & emotion tracking",
    "Export your data anytime"
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="flex items-center justify-center mb-4">
          <Crown className="h-12 w-12 text-yellow-500 mr-2" />
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            <TranslatableText text="Welcome to SOULo Premium" />
          </h2>
        </div>
        
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          <TranslatableText text="Experience the full potential of your mental wellness journey with our premium features." />
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Free Trial Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">
                <Sparkles className="h-3 w-3 mr-1" />
                <TranslatableText text="Recommended" />
              </Badge>
            </div>
            
            <CardHeader>
              <CardTitle className="text-2xl">
                <TranslatableText text="7-Day Free Trial" />
              </CardTitle>
              <CardDescription className="text-lg">
                <TranslatableText text="Try all premium features for free" />
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-sm">
                      <TranslatableText text={feature} />
                    </span>
                  </div>
                ))}
              </div>
              
              <Button
                onClick={handleStartTrial}
                disabled={trialStarting || loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                size="lg"
              >
                {trialStarting ? (
                  <TranslatableText text="Starting trial..." />
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    <TranslatableText text="Start Free Trial" />
                  </>
                )}
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                <TranslatableText text="No payment required • Cancel anytime" />
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Free Plan Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-2xl">
                <TranslatableText text="Continue with Free Plan" />
              </CardTitle>
              <CardDescription>
                <TranslatableText text="Start with basic features" />
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-sm">
                    <TranslatableText text="50 journal entries" />
                  </span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-sm">
                    <TranslatableText text="100 chat messages" />
                  </span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-sm">
                    <TranslatableText text="Basic insights" />
                  </span>
                </div>
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-sm">
                    <TranslatableText text="Core mood tracking" />
                  </span>
                </div>
              </div>
              
              <Button
                onClick={onContinue}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <TranslatableText text="Continue with Free" />
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                <TranslatableText text="Upgrade anytime to unlock more features" />
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
