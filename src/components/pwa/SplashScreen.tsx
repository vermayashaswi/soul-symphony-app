
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SouloLogo from '@/components/SouloLogo';
import { useUserColorThemeHex } from '@/components/insights/soulnet/useUserColorThemeHex';

interface SplashScreenProps {
  isLoading: boolean;
  onComplete?: () => void;
  minDisplayTime?: number;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ 
  isLoading, 
  onComplete,
  minDisplayTime = 2000 
}) => {
  const [showSplash, setShowSplash] = useState(true);
  const [progress, setProgress] = useState(0);
  const themeColor = useUserColorThemeHex();

  useEffect(() => {
    const startTime = Date.now();
    
    // Simulate loading progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 20;
      });
    }, 100);

    // Handle splash screen completion
    const checkComplete = () => {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayTime - elapsed);
      
      setTimeout(() => {
        setShowSplash(false);
        onComplete?.();
      }, remainingTime);
    };

    if (!isLoading && progress >= 100) {
      checkComplete();
    }

    return () => {
      clearInterval(progressInterval);
    };
  }, [isLoading, progress, minDisplayTime, onComplete]);

  if (!showSplash) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-background via-background/95 to-background"
        style={{
          background: `linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, ${themeColor}15 100%)`
        }}
      >
        {/* Main Content */}
        <div className="flex flex-col items-center space-y-8 px-6 text-center">
          {/* Logo with Animation */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              duration: 1,
              ease: "easeOut",
              delay: 0.2
            }}
            className="relative"
          >
            <div className="absolute inset-0 animate-pulse rounded-full opacity-20"
                 style={{ backgroundColor: themeColor, filter: 'blur(20px)' }} />
            <SouloLogo size="extra-large" animate={true} useColorTheme={true} />
          </motion.div>

          {/* App Name */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="space-y-2"
          >
            <h1 className="text-3xl font-bold text-foreground">
              Soulo
            </h1>
            <p className="text-lg text-muted-foreground max-w-sm">
              AI-powered voice journaling for emotional wellness
            </p>
          </motion.div>

          {/* Loading Progress */}
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '100%', opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="w-full max-w-xs space-y-3"
          >
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: themeColor }}
                initial={{ width: '0%' }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Loading your wellness companion...
            </p>
          </motion.div>
        </div>

        {/* Floating Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full opacity-30"
              style={{ backgroundColor: themeColor }}
              animate={{
                x: [0, Math.random() * 100 - 50],
                y: [0, Math.random() * 100 - 50],
                scale: [1, 1.5, 1],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                repeatType: "reverse",
                delay: Math.random() * 2,
              }}
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
              }}
            />
          ))}
        </div>

        {/* Copyright */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
          className="absolute bottom-6 text-xs text-muted-foreground"
        >
          © 2024 Soulo. Your journey to wellness.
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashScreen;
