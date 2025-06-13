
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';
import AnimatedLogo from '@/components/splash/AnimatedLogo';
import SplashBackground from '@/components/splash/SplashBackground';
import { motion } from 'framer-motion';

const Splash = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Show content after a brief delay
    const contentTimer = setTimeout(() => {
      setShowContent(true);
    }, 300);

    // Navigate after animation completes
    const navigationTimer = setTimeout(() => {
      if (user) {
        if (onboardingComplete) {
          navigate('/app/home');
        } else {
          navigate('/app/onboarding');
        }
      } else {
        navigate('/app/auth');
      }
    }, 4500); // Total animation duration + small buffer

    return () => {
      clearTimeout(contentTimer);
      clearTimeout(navigationTimer);
    };
  }, [user, onboardingComplete, navigate]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-100 overflow-hidden">
      {/* Background Animation */}
      <SplashBackground />
      
      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {showContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            {/* Animated Logo */}
            <AnimatedLogo />
            
            {/* Tagline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3.2, duration: 0.8 }}
              className="mt-8"
            >
              <p className="text-lg text-purple-700 font-medium tracking-wide">
                Your journey to mindful self-discovery
              </p>
            </motion.div>
            
            {/* Loading indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3.8, duration: 0.6 }}
              className="mt-12 flex justify-center"
            >
              <div className="flex space-x-2">
                {[0, 1, 2].map((index) => (
                  <motion.div
                    key={index}
                    className="w-2 h-2 bg-purple-400 rounded-full"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: index * 0.2,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Splash;
