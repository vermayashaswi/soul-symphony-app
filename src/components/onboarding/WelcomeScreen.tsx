
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface WelcomeScreenProps {
  onContinue: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full px-6 py-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.h1 variants={itemVariants} className="text-3xl font-bold mb-6 text-center">
        Welcome to SOuLO
      </motion.h1>
      
      <motion.p variants={itemVariants} className="text-muted-foreground mb-8 text-center max-w-md">
        Get ready to start your journey to better mental wellbeing with SOuLO,
        your personal emotional wellness companion.
      </motion.p>
      
      <motion.div variants={itemVariants} className="mb-8 text-center">
        <p className="text-muted-foreground">
          In the next few steps, we'll help you set up your profile and preferences.
        </p>
      </motion.div>
      
      <motion.div variants={itemVariants}>
        <Button onClick={onContinue} size="lg" className="w-full min-w-[200px]">
          Get Started
        </Button>
      </motion.div>
    </motion.div>
  );
};

export default WelcomeScreen;
