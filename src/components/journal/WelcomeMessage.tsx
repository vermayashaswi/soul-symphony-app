
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Mic } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface WelcomeMessageProps {
  onStartRecording: () => void;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({ onStartRecording }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-64 p-8 text-center"
    >
      <div className="mb-6">
        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 mx-auto">
          <Mic className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-medium mb-2"><TranslatableText text="Welcome to SOuLO!" /></h3>
        <p className="text-muted-foreground mb-6">
          <TranslatableText text="Your journal journey begins with your voice. Start recording your first entry now." />
        </p>
      </div>
      <Button 
        onClick={onStartRecording} 
        size="lg" 
        className="gap-2 animate-pulse"
      >
        <Mic className="h-5 w-5" />
        <TranslatableText text="Start Journaling" />
      </Button>
    </motion.div>
  );
};
