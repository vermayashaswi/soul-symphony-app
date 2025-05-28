
import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Sparkles, MessageSquare, TrendingUp, Shield } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface PremiumFeaturesStepProps {
  onStartTrial: () => void;
  isLoading: boolean;
}

const PremiumFeaturesStep: React.FC<PremiumFeaturesStepProps> = ({ 
  onStartTrial, 
  isLoading 
}) => {
  const features = [
    {
      icon: MessageSquare,
      title: "Advanced AI Chat",
      description: "Deep conversations with your journal entries"
    },
    {
      icon: TrendingUp,
      title: "Detailed Analytics",
      description: "Track emotional patterns and growth over time"
    },
    {
      icon: Sparkles,
      title: "Enhanced Insights",
      description: "Get personalized recommendations and themes"
    },
    {
      icon: Shield,
      title: "Priority Support",
      description: "Get help when you need it most"
    }
  ];

  return (
    <div className="flex flex-col justify-center items-center my-2 w-full">
      <motion.div 
        className="relative w-full max-w-sm bg-gradient-to-b from-theme/10 to-theme/20 rounded-xl p-6 overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Premium Crown Icon */}
        <motion.div
          className="flex justify-center mb-4"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
        >
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
            <Crown className="w-8 h-8 text-white" />
          </div>
        </motion.div>

        {/* Premium Features List */}
        <motion.div 
          className="space-y-3 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="flex items-start gap-3 p-2 bg-white/10 rounded-lg"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 + index * 0.1 }}
            >
              <div className="w-8 h-8 bg-theme/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <feature.icon className="w-4 h-4 text-theme" />
              </div>
              <div>
                <h4 className="font-medium text-foreground text-sm">
                  <TranslatableText text={feature.title} forceTranslate={true} />
                </h4>
                <p className="text-xs text-muted-foreground">
                  <TranslatableText text={feature.description} forceTranslate={true} />
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Trial Offer */}
        <motion.div
          className="text-center space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="text-lg font-bold text-theme">
            <TranslatableText text="7 Days Free" forceTranslate={true} />
          </div>
          <div className="text-sm text-muted-foreground">
            <TranslatableText text="Then $9.99/month • Cancel anytime" forceTranslate={true} />
          </div>
        </motion.div>

        {/* Floating particles */}
        <motion.div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute w-1 h-1 bg-theme/30 rounded-full"
              style={{
                left: `${20 + (i * 10)}%`,
                top: `${10 + (i % 3) * 30}%`,
              }}
              animate={{
                y: [0, -10, 0],
                opacity: [0.3, 0.7, 0.3],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2 + i * 0.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.3,
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default PremiumFeaturesStep;
