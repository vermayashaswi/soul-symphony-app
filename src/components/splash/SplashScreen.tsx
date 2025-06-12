
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SouloLogo from '@/components/SouloLogo';
import { Progress } from '@/components/ui/progress';
import { useTheme } from '@/hooks/use-theme';

interface SplashScreenProps {
  onComplete: () => void;
  isVisible: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, isVisible }) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('Initializing...');
  const { colorTheme } = useTheme();

  useEffect(() => {
    if (!isVisible) return;

    const stages = [
      { progress: 20, stage: 'Loading app resources...' },
      { progress: 40, stage: 'Connecting to services...' },
      { progress: 60, stage: 'Preparing your journal...' },
      { progress: 80, stage: 'Almost ready...' },
      { progress: 100, stage: 'Welcome to SOULo!' }
    ];

    let currentStageIndex = 0;
    
    const progressInterval = setInterval(() => {
      if (currentStageIndex < stages.length) {
        const currentStage = stages[currentStageIndex];
        setLoadingProgress(currentStage.progress);
        setLoadingStage(currentStage.stage);
        currentStageIndex++;
      } else {
        clearInterval(progressInterval);
        // Wait a moment before completing
        setTimeout(() => {
          onComplete();
        }, 800);
      }
    }, 600);

    return () => clearInterval(progressInterval);
  }, [isVisible, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-background via-background/95 to-primary/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div 
              className="absolute -top-1/2 -left-1/2 w-full h-full opacity-10 rounded-full blur-3xl"
              style={{ backgroundColor: `hsl(var(--primary))` }}
            />
            <div 
              className="absolute -bottom-1/2 -right-1/2 w-full h-full opacity-10 rounded-full blur-3xl"
              style={{ backgroundColor: `hsl(var(--primary))` }}
            />
          </div>

          {/* Logo Container */}
          <motion.div
            className="flex flex-col items-center space-y-8 relative z-10"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              duration: 0.8, 
              ease: "easeOut",
              delay: 0.2
            }}
          >
            {/* Animated Logo */}
            <motion.div
              className="relative"
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [0, 360]
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <SouloLogo size="large" useColorTheme={true} />
              
              {/* Pulsing Ring Around Logo */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 opacity-30"
                style={{ borderColor: `hsl(var(--primary))` }}
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.1, 0.3]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </motion.div>

            {/* App Name */}
            <motion.div
              className="text-center"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ 
                duration: 0.6,
                delay: 0.5
              }}
            >
              <h1 
                className="text-4xl md:text-5xl font-bold tracking-tight mb-2"
                style={{ color: `hsl(var(--primary))` }}
              >
                SOULo
              </h1>
              <p className="text-lg text-muted-foreground font-medium">
                Voice Journaling with AI
              </p>
            </motion.div>

            {/* Loading Section */}
            <motion.div
              className="w-80 max-w-sm space-y-4"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ 
                duration: 0.6,
                delay: 0.8
              }}
            >
              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress 
                  value={loadingProgress} 
                  className="h-2 bg-muted"
                />
                
                {/* Loading Text */}
                <motion.p
                  className="text-sm text-center text-muted-foreground"
                  key={loadingStage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {loadingStage}
                </motion.p>
              </div>
            </motion.div>
          </motion.div>

          {/* Bottom Branding */}
          <motion.div
            className="absolute bottom-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ 
              duration: 0.6,
              delay: 1.2
            }}
          >
            <p className="text-xs text-muted-foreground">
              Express • Reflect • Grow
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
