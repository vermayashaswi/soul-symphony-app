
import React from 'react';
import { motion } from 'framer-motion';
import { OnboardingLayout } from './OnboardingLayout';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Heart, Gem, Sparkles } from 'lucide-react';

export function OnboardingComplete() {
  const { userName, completeOnboarding, currentStep } = useOnboarding();
  const navigate = useNavigate();
  
  const handleComplete = () => {
    completeOnboarding();
    navigate('/journal');
  };
  
  const features = [
    {
      icon: <BookOpen className="h-6 w-6 text-amber-500" />,
      title: "Build a Grateful Mindset",
      description: "with guided prompts and challenges"
    },
    {
      icon: <Heart className="h-6 w-6 text-pink-500" />,
      title: "Develop Positive Self-Talk",
      description: "with 600+ exclusive affirmations"
    },
    {
      icon: <Gem className="h-6 w-6 text-purple-500" />,
      title: "Visualize Your Goals",
      description: "with powerful vision boards"
    },
    {
      icon: <Sparkles className="h-6 w-6 text-yellow-500" />,
      title: "Stay Inspired",
      description: "with motivating quotes and resources"
    }
  ];
  
  return (
    <OnboardingLayout
      onContinue={handleComplete}
      showBackButton={false}
      continueText="Done"
      currentStep={currentStep}
    >
      <div className="flex flex-col h-full">
        <motion.div
          className="space-y-2 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold">
            You're all set, {userName}!
          </h1>
          <p className="text-lg text-muted-foreground">
            We'll help you with:
          </p>
        </motion.div>
        
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, staggerChildren: 0.1 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="flex gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + (index * 0.1) }}
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                {feature.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </OnboardingLayout>
  );
}
