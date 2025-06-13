
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
    }, 200);

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
    }, 5500); // Extended for the enhanced animation

    return () => {
      clearTimeout(contentTimer);
      clearTimeout(navigationTimer);
    };
  }, [user, onboardingComplete, navigate]);

  return (
    <div className="relative min-h-screen bg-purple-900 overflow-hidden">
      {/* Enhanced Background Animation */}
      <SplashBackground />
      
      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
        {showContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="text-center"
          >
            {/* Enhanced Animated Logo */}
            <AnimatedLogo />
            
            {/* Tagline with better contrast */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 4, duration: 1 }}
              className="mt-12"
            >
              <p className="text-xl md:text-2xl text-purple-100 font-medium tracking-wide drop-shadow-lg">
                Your journey to mindful self-discovery
              </p>
            </motion.div>
            
            {/* Enhanced loading indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 4.5, duration: 0.8 }}
              className="mt-16 flex justify-center"
            >
              <div className="flex space-x-3">
                {[0, 1, 2].map((index) => (
                  <motion.div
                    key={index}
                    className="w-3 h-3 bg-purple-200 rounded-full shadow-lg"
                    animate={{
                      scale: [1, 1.8, 1],
                      opacity: [0.4, 1, 0.4],
                      boxShadow: [
                        "0 0 0px rgba(196, 181, 253, 0.5)",
                        "0 0 15px rgba(196, 181, 253, 0.8)",
                        "0 0 0px rgba(196, 181, 253, 0.5)"
                      ]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: index * 0.3,
                      ease: "easeInOut"
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
