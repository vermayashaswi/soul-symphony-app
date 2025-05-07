
import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from '@/contexts/TutorialContext';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Progress } from '@/components/ui/progress';

const TutorialModal: React.FC = () => {
  const { 
    isActive, 
    currentStep, 
    nextStep, 
    previousStep, 
    skipTutorial,
    tutorialProgress
  } = useTutorial();

  return (
    <Dialog open={isActive} onOpenChange={(open) => !open && skipTutorial()}>
      <DialogContent className="sm:max-w-md rounded-lg p-0 overflow-hidden">
        <div className="relative">
          {/* Progress bar */}
          <div className="absolute top-0 left-0 w-full z-10">
            <Progress value={tutorialProgress} className="h-1 rounded-none" />
          </div>
          
          <div className="p-6 pt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="min-h-[300px]"
              >
                <TutorialContent step={currentStep} />
              </motion.div>
            </AnimatePresence>
            
            <div className="flex justify-between mt-6">
              <div>
                {currentStep !== 'welcome' && (
                  <Button variant="outline" onClick={previousStep}>
                    <TranslatableText text="Previous" />
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={skipTutorial}>
                  <TranslatableText text="Skip" />
                </Button>
                <Button onClick={nextStep}>
                  {currentStep === 'complete' ? (
                    <TranslatableText text="Finish" />
                  ) : (
                    <TranslatableText text="Next" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface TutorialContentProps {
  step: string;
}

const TutorialContent: React.FC<TutorialContentProps> = ({ step }) => {
  switch (step) {
    case 'welcome':
      return <WelcomeStep />;
    case 'journal':
      return <JournalStep />;
    case 'insights':
      return <InsightsStep />;
    case 'chat':
      return <ChatStep />;
    case 'settings':
      return <SettingsStep />;
    case 'complete':
      return <CompleteStep />;
    default:
      return <div>Unknown step</div>;
  }
};

const WelcomeStep: React.FC = () => (
  <div className="text-center">
    <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
      <span className="text-xl">👋</span>
    </div>
    <h2 className="text-xl font-bold mb-3">
      <TranslatableText text="Welcome to SOULo!" />
    </h2>
    <p className="text-muted-foreground mb-4">
      <TranslatableText text="Your personal AI companion for wellness journaling. Let's explore the app's key features together." />
    </p>
    <div className="p-4 rounded-lg bg-muted text-sm">
      <TranslatableText text="This tutorial will guide you through the main features of the app. You can restart it anytime from the settings page." />
    </div>
  </div>
);

const JournalStep: React.FC = () => (
  <div>
    <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
      <span className="text-xl">📝</span>
    </div>
    <h2 className="text-xl font-bold mb-3 text-center">
      <TranslatableText text="Journal" />
    </h2>
    <p className="text-muted-foreground mb-4 text-center">
      <TranslatableText text="Record your thoughts and feelings using voice or text. Our AI analyzes your entries to identify emotions and themes." />
    </p>
    <div className="rounded-lg overflow-hidden border">
      <img 
        src="/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png" 
        alt="Journal feature" 
        className="w-full h-auto object-cover"
      />
    </div>
  </div>
);

const InsightsStep: React.FC = () => (
  <div>
    <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
      <span className="text-xl">📊</span>
    </div>
    <h2 className="text-xl font-bold mb-3 text-center">
      <TranslatableText text="Insights" />
    </h2>
    <p className="text-muted-foreground mb-4 text-center">
      <TranslatableText text="Explore emotional patterns and trends from your journal entries. Gain deeper understanding of your well-being." />
    </p>
    <div className="space-y-2 mt-2">
      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30">
        <TranslatableText text="Mood Tracking" />
      </div>
      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30">
        <TranslatableText text="Theme Analysis" />
      </div>
      <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/30">
        <TranslatableText text="Soul-Net Visualization" />
      </div>
    </div>
  </div>
);

const ChatStep: React.FC = () => (
  <div>
    <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
      <span className="text-xl">💬</span>
    </div>
    <h2 className="text-xl font-bold mb-3 text-center">
      <TranslatableText text="Chat with Ruh" />
    </h2>
    <p className="text-muted-foreground mb-4 text-center">
      <TranslatableText text="Ask questions about your journal entries and emotions. Ruh provides personalized insights based on your journaling." />
    </p>
    <div className="border rounded-lg p-3 bg-muted/20 text-sm">
      <p className="mb-2 font-medium">
        <TranslatableText text="Try asking:" />
      </p>
      <ul className="space-y-1 list-disc pl-4">
        <li><TranslatableText text="What emotions have I been feeling lately?" /></li>
        <li><TranslatableText text="What themes appear in my journal?" /></li>
        <li><TranslatableText text="How can I improve my emotional wellbeing?" /></li>
      </ul>
    </div>
  </div>
);

const SettingsStep: React.FC = () => (
  <div>
    <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
      <span className="text-xl">⚙️</span>
    </div>
    <h2 className="text-xl font-bold mb-3 text-center">
      <TranslatableText text="Settings" />
    </h2>
    <p className="text-muted-foreground mb-4 text-center">
      <TranslatableText text="Personalize your experience with custom settings including themes, language preferences, and profile information." />
    </p>
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span><TranslatableText text="Dark Mode" /></span>
        <div className="w-10 h-5 bg-primary rounded-full relative">
          <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span><TranslatableText text="Language" /></span>
        <span className="text-sm bg-muted px-2 py-1 rounded">English</span>
      </div>
      <div className="flex items-center justify-between">
        <span><TranslatableText text="Restart Tutorial" /></span>
        <Button variant="ghost" size="sm">
          <TranslatableText text="Restart" />
        </Button>
      </div>
    </div>
  </div>
);

const CompleteStep: React.FC = () => (
  <div className="text-center">
    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto mb-4 flex items-center justify-center">
      <span className="text-xl">✅</span>
    </div>
    <h2 className="text-xl font-bold mb-3">
      <TranslatableText text="You're all set!" />
    </h2>
    <p className="text-muted-foreground mb-4">
      <TranslatableText text="You've completed the tutorial and are ready to start using SOULo. We're excited to join you on your wellness journey!" />
    </p>
    <p className="text-sm bg-primary/10 p-3 rounded-lg">
      <TranslatableText text="Remember, you can restart this tutorial anytime from the Settings page." />
    </p>
  </div>
);

export default TutorialModal;
