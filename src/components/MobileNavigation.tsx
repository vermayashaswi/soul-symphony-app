
import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MessageCircle, BookOpen, BarChart2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isNativeApp, isAppRoute } from '@/routes/RouteHelpers';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTutorial } from '@/contexts/TutorialContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';

interface MobileNavigationProps {
  onboardingComplete: boolean | null;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ onboardingComplete }) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const { isActive: isTutorialActive } = useTutorial();
  const { user } = useAuth();
  const { currentLanguage } = useTranslation();
  
  useEffect(() => {
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.75;
        setIsKeyboardVisible(isKeyboard);
      }
    };
    
    handleVisualViewportResize();
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      window.addEventListener('resize', handleVisualViewportResize);
    }
    
    const handleKeyboardOpen = () => setIsKeyboardVisible(true);
    const handleKeyboardClose = () => setIsKeyboardVisible(false);
    
    window.addEventListener('keyboardOpen', handleKeyboardOpen);
    window.addEventListener('keyboardClose', handleKeyboardClose);
    
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.removeEventListener('resize', handleVisualViewportResize);
      }
      
      window.removeEventListener('keyboardOpen', handleKeyboardOpen);
      window.removeEventListener('keyboardClose', handleKeyboardClose);
    };
  }, []);
  
  useEffect(() => {
    // Comprehensive list of paths where navigation should be hidden - must match ViewportManager
    const onboardingOrAuthPaths = [
      '/app/onboarding',
      '/app/auth',
      '/onboarding',
      '/auth',
      '/app',
      '/' // Also hide on root path
    ];
    
    // Check if current path is in the list of paths where navigation should be hidden
    const isOnboardingOrAuth = onboardingOrAuthPaths.includes(location.pathname);
    
    // Explicit check for app root path - hide navigation here regardless of onboarding status
    const isAppRoot = location.pathname === '/app';
    
    // Only show navigation if:
    // 1. We're on mobile or in native app
    // 2. Keyboard is not visible
    // 3. We're not on an onboarding/auth screen
    // 4. User is authenticated
    // 5. Onboarding is complete if we're checking
    const shouldShowNav = (isMobile || isNativeApp()) && 
                          !isKeyboardVisible && 
                          !isOnboardingOrAuth &&
                          !!user &&
                          onboardingComplete !== false;
    
    console.log('MobileNavigation visibility check:', { 
      shouldShowNav, 
      isMobile, 
      isNativeApp: isNativeApp(),
      path: location.pathname,
      isKeyboardVisible,
      isOnboardingOrAuth,
      isAppRoot,
      hasUser: !!user,
      onboardingComplete,
      isTutorialActive
    });
    
    setIsVisible(shouldShowNav);
  }, [location.pathname, isMobile, isKeyboardVisible, isTutorialActive, user, onboardingComplete]);
  
  if (!isVisible) {
    return null;
  }
  
  // Additional safety check - don't show if onboarding is not complete
  if (onboardingComplete === false || location.pathname === '/app') {
    console.log('MobileNavigation: Not rendering due to onboarding status or /app path');
    return null;
  }
  
  // Updated navItems to use actual English text instead of translation keys
  const navItems = [
    { path: '/app/home', icon: Home, label: 'Home' },
    { path: '/app/journal', icon: BookOpen, label: 'Journal' },
    { path: '/app/smart-chat', icon: MessageCircle, label: 'Chat' },
    { path: '/app/insights', icon: BarChart2, label: 'Insights' },
    { path: '/app/settings', icon: Settings, label: 'Settings' },
  ];

  const getActiveStatus = (path: string) => {
    return location.pathname.startsWith(path);
  };
  
  // Enhanced debug logging for translation
  console.log('MobileNavigation: Current language:', currentLanguage);
  console.log('MobileNavigation: Location pathname:', location.pathname);
  console.log('MobileNavigation: Nav items with labels:', navItems.map(item => ({
    path: item.path,
    label: item.label
  })));
  
  return (
    <motion.div 
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-background border-t border-muted",
        isTutorialActive && "opacity-30 pointer-events-none" // Fade out and disable interaction during tutorial
      )}
      style={{
        zIndex: 9998, // Lower z-index than tutorial overlay (9999)
        paddingTop: '0.40rem',
        paddingBottom: 'max(0.40rem, env(safe-area-inset-bottom))',
        height: 'calc(3.6rem + env(safe-area-inset-bottom))'
      }}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const isActive = getActiveStatus(item.path);
          
          console.log(`MobileNavigation: Rendering nav item "${item.label}" for path ${item.path} with forceTranslate=true`);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center py-1 transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              <div className="relative">
                <item.icon size={22} />
                {isActive && (
                  <motion.div
                    layoutId="mobileNavIndicator"
                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.3 }}
                  />
                )}
              </div>
              <span className="text-xs mt-0.5">
                <TranslatableText 
                  text={item.label} 
                  forceTranslate={true}
                  onTranslationStart={() => console.log(`MobileNavigation: Translation started for "${item.label}"`)}
                  onTranslationEnd={() => console.log(`MobileNavigation: Translation completed for "${item.label}"`)}
                />
              </span>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
};

export default MobileNavigation;
