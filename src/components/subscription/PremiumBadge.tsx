
import React from 'react';
import { Crown, Sparkles, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { motion } from 'framer-motion';

interface PremiumBadgeProps {
  onUpgrade?: () => void;
  className?: string;
}

const PremiumBadge: React.FC<PremiumBadgeProps> = ({ onUpgrade, className = '' }) => {
  const { isPremium, isTrialActive, daysRemainingInTrial, subscriptionStatus } = useSubscription();

  if (isPremium && isTrialActive) {
    return (
      <Card className={`bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/20 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">
                    <TranslatableText text="Premium Trial" forceTranslate={true} />
                  </h3>
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">
                    <TranslatableText text="Active" forceTranslate={true} />
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <TranslatableText 
                    text={`${daysRemainingInTrial} days remaining`} 
                    forceTranslate={true} 
                  />
                </p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-5 h-5 text-yellow-500" />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isPremium && !isTrialActive) {
    return (
      <Card className={`bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">
                    <TranslatableText text="Premium Member" forceTranslate={true} />
                  </h3>
                  <Badge className="bg-purple-500 text-white">
                    <TranslatableText text="Active" forceTranslate={true} />
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <TranslatableText text="Enjoying all premium features" forceTranslate={true} />
                </p>
              </div>
            </div>
            <Crown className="w-5 h-5 text-purple-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-gradient-to-r from-theme/5 to-theme-light/5 border-theme/20 hover:border-theme/40 transition-colors cursor-pointer ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                <TranslatableText text="Upgrade to Premium" forceTranslate={true} />
              </h3>
              <p className="text-sm text-muted-foreground">
                <TranslatableText text="Unlock advanced features" forceTranslate={true} />
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onUpgrade}
            className="border-theme text-theme hover:bg-theme hover:text-white"
          >
            <TranslatableText text="Try Free" forceTranslate={true} />
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PremiumBadge;
