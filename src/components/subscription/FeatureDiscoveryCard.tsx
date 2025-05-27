
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, ArrowRight, Sparkles } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { SubscriptionPaywall } from './SubscriptionPaywall';

interface FeatureDiscoveryCardProps {
  feature: {
    name: string;
    description: string;
    benefits: string[];
    icon: React.ReactNode;
  };
  context?: 'home' | 'journal' | 'chat' | 'insights';
}

export function FeatureDiscoveryCard({ feature, context = 'home' }: FeatureDiscoveryCardProps) {
  const [showPaywall, setShowPaywall] = useState(false);

  if (showPaywall) {
    return (
      <SubscriptionPaywall
        onSuccess={() => setShowPaywall(false)}
        onClose={() => setShowPaywall(false)}
        showTrialOption={true}
      />
    );
  }

  return (
    <Card className="relative overflow-hidden border-2 border-dashed border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
      <div className="absolute top-2 right-2">
        <Badge className="bg-gradient-to-r from-purple-600 to-blue-600">
          <Crown className="h-3 w-3 mr-1" />
          <TranslatableText text="Premium" />
        </Badge>
      </div>
      
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-full">
            {feature.icon}
          </div>
          <div>
            <CardTitle className="text-lg">
              <TranslatableText text={feature.name} />
            </CardTitle>
            <CardDescription>
              <TranslatableText text={feature.description} />
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {feature.benefits.map((benefit, index) => (
            <li key={index} className="flex items-center text-sm">
              <Sparkles className="h-4 w-4 text-purple-500 mr-2 flex-shrink-0" />
              <TranslatableText text={benefit} />
            </li>
          ))}
        </ul>
        
        <Button
          onClick={() => setShowPaywall(true)}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          <TranslatableText text="Unlock This Feature" />
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
