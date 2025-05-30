
import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Crown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface TrialExpiredBlockerProps {
  feature: string;
  onUpgrade: () => void;
  className?: string;
}

export const TrialExpiredBlocker: React.FC<TrialExpiredBlockerProps> = ({
  feature,
  onUpgrade,
  className
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-background rounded-xl border border-muted",
        className
      )}
    >
      <div className="relative mb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
          <Crown className="w-4 h-4 text-white" />
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-3 text-foreground">
        <TranslatableText text="Trial Expired" forceTranslate={true} />
      </h2>
      
      <p className="text-muted-foreground mb-2 max-w-md">
        <TranslatableText 
          text={`Your free trial has ended. Upgrade to continue using ${feature} and unlock all premium features.`}
          forceTranslate={true}
        />
      </p>

      <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <TranslatableText text="Premium features include unlimited access" forceTranslate={true} />
      </div>

      <Button 
        onClick={onUpgrade}
        size="lg"
        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
      >
        <Crown className="w-5 h-5 mr-2" />
        <TranslatableText text="Upgrade to Premium" forceTranslate={true} />
      </Button>

      <p className="text-xs text-muted-foreground mt-4 opacity-75">
        <TranslatableText text="Cancel anytime • 7-day money-back guarantee" forceTranslate={true} />
      </p>
    </motion.div>
  );
};
