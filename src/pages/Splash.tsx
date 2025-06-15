
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useIsMobile } from '@/hooks/use-mobile';
import { pwaService } from '@/services/pwaService';
import AnimatedLogo from '@/components/splash/AnimatedLogo';
import SplashBackground from '@/components/splash/SplashBackground';
import { motion } from 'framer-motion';

const Splash = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const isMobile = useIsMobile();
  const [showContent, setShowContent] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);

  useEffect(() => {
    // Detect native app context
    const pwaInfo = pwaService.getPWAInfo();
    const nativeContext = pwaInfo.isStandalone || 
                         window.navigator.userAgent.includes('wv') || // WebView
                         window.ReactNativeWebView !== undefined;
    
    setIsNativeApp(nativeContext);
    
    console.log('[Splash] Environment detection:', {
      isStandalone: pwaInfo.isStandalone,
      platform: pwaInfo.platform,
      isMobile: isMobile.isMobile,
      isNativeApp: nativeContext,
      userAgent: window.navigator.userAgent
    });
  }, [isMobile.isMobile]);

  useEffect(() => {
    // Mobile-optimized timing
    const contentDelay = isNativeApp ? 100 : 200;
    const navigationDelay = isNativeApp ? 3000 : 5500;

    // Show content after optimized delay
    const contentTimer = setTimeout(() => {
      setShowContent(true);
    }, contentDelay);

    // Navigate after animation completes
    const navigationTimer = setTimeout(() => {
      console.log('[Splash] Navigation logic starting:', {
        user: !!user,
        onboardingComplete
      });

      if (user) {
        if (onboardingComplete) {
          console.log('[Splash] User authenticated and onboarded, going to home');
          navigate('/app/home', { replace: true });
        } else {
          console.log('[Splash] User authenticated but needs onboarding');
          navigate('/app/onboarding', { replace: true });
        }
      } else {
        console.log('[Splash] User not authenticated, going to auth');
        navigate('/app/auth', { replace: true });
      }
    }, navigationDelay);

    return () => {
      clearTimeout(contentTimer);
      clearTimeout(navigationTimer);
    };
  }, [user, onboardingComplete, navigate, isNativeApp]);

  // Mobile-specific optimizations
  useEffect(() => {
    if (isMobile.isMobile) {
      // Prevent scrolling during splash
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      
      // Optimize for mobile performance
      document.documentElement.style.setProperty('--splash-animation-duration', '3s');
      
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      };
    }
  }, [isMobile.isMobile]);

  return (
    <div className="relative min-h-screen bg-purple-900 overflow-hidden">
      {/* Mobile status bar spacing for native apps */}
      {isNativeApp && (
        <div className="h-safe-area-inset-top bg-purple-900" />
      )}
      
      {/* Enhanced Background Animation */}
      <SplashBackground />
      
      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 safe-area-inset">
        {showContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: isNativeApp ? 0.8 : 1 }}
            className="text-center"
          >
            {/* Enhanced Animated Logo */}
            <AnimatedLogo />
            
            {/* Mobile-optimized tagline */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                delay: isNativeApp ? 2.5 : 4, 
                duration: isNativeApp ? 0.8 : 1 
              }}
              className="mt-8 md:mt-12"
            >
              <p className="text-lg md:text-xl lg:text-2xl text-purple-100 font-medium tracking-wide drop-shadow-lg px-4">
                Your journey to mindful self-discovery
              </p>
            </motion.div>
            
            {/* Enhanced loading indicator with mobile optimization */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ 
                delay: isNativeApp ? 2.8 : 4.5, 
                duration: 0.8 
              }}
              className="mt-12 md:mt-16 flex justify-center"
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
                      duration: isNativeApp ? 1.5 : 2,
                      repeat: Infinity,
                      delay: index * 0.3,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </div>
            </motion.div>

            {/* Native app indicator */}
            {isNativeApp && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
              >
                <div className="bg-purple-800/50 backdrop-blur-sm rounded-full px-4 py-2">
                  <p className="text-purple-200 text-sm">Native App Mode</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
      
      {/* Mobile safe area bottom spacing */}
      {isNativeApp && (
        <div className="h-safe-area-inset-bottom bg-purple-900" />
      )}
    </div>
  );
};

export default Splash;
