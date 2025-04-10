
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface WelcomeScreenProps {
  onContinue: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="text-center space-y-4">
        <p className="text-lg">
          Welcome to Soulo, your personal journaling and emotional wellbeing companion.
        </p>
        <p>
          We're excited to help you track your mood, journal your thoughts, and gain insights into your emotional wellbeing.
        </p>
      </div>
      
      <div className="pt-4">
        <Button 
          onClick={onContinue}
          className="w-full"
        >
          Get Started
        </Button>
      </div>
    </motion.div>
  );
};

export default WelcomeScreen;
