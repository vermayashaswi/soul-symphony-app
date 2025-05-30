
import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MessageCircle, BookOpen, BarChart2, Settings, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isNativeApp, isAppRoute } from '@/routes/RouteHelpers';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTutorial } from '@/contexts/TutorialContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { useTrialAccess } from '@/hooks/useTrialAccess';

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
  const { hasAccess, isTrialExpired, openSubscriptionModal } = useTrialAccess();
  
  // Debug: Force component re-render when language changes
  const [renderKey, setRenderKey] = useState(0);
  
  useEffect(() => {
    const handleLanguageChange = () => {
      console.log('MobileNavigation: Language change detected, forcing re-render');
      setRenderKey(prev => prev + 1);
    };
    
    window.addEventListener('languageChange', handleLanguageChange);
    return () => window.removeEventListener('languageChange', handleLanguageChange);
  }, []);
  
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
    const onboardingOrAuthPaths = [
      '/app/onboarding',
      '/app/auth',
      '/onboarding',
      '/auth',
      '/app',
      '/'
    ];
    
    const isOnboardingOrAuth = onboardingOrAuthPaths.includes(location.pathname);
    const isAppRoot = location.pathname === '/app';
    
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
      isTutorialActive,
      currentLanguage,
      renderKey
    });
    
    setIsVisible(shouldShowNav);
  }, [location.pathname, isMobile, isKeyboardVisible, isTutorialActive, user, onboardingComplete, currentLanguage, renderKey]);
  
  if (!isVisible) {
    return null;
  }
  
  if (onboardingComplete === false || location.pathname === '/app') {
    console.log('MobileNavigation: Not rendering due to onboarding status or /app path');
    return null;
  }
  
  // Check if a route requires premium access
  const isPremiumRoute = useCallback((path: string) => {
    return path === '/app/smart-chat' || path === '/app/insights';
  }, []);

  // Optimized navigation handler with immediate modal trigger
  const handleNavigation = useCallback((path: string, e: React.MouseEvent) => {
    const needsUpgrade = isPremiumRoute(path) && !hasAccess && isTrialExpired;
    
    if (needsUpgrade) {
      e.preventDefault();
      console.log('[MobileNavigation] Blocking navigation to premium route, opening modal');
      
      // Immediate modal open without delay
      openSubscriptionModal();
      return;
    }
  }, [isPremiumRoute, hasAccess, isTrialExpired, openSubscriptionModal]);
  
  // Navigation items with English text for translation
  const navItems = [
    { path: '/app/home', icon: Home, label: 'Home', requiresPremium: false },
    { path: '/app/journal', icon: BookOpen, label: 'Journal', requiresPremium: false },
    { path: '/app/smart-chat', icon: MessageCircle, label: 'Chat', requiresPremium: true },
    { path: '/app/insights', icon: BarChart2, label: 'Insights', requiresPremium: true },
    { path: '/app/settings', icon: Settings, label: 'Settings', requiresPremium: false },
  ];

  const getActiveStatus = useCallback((path: string) => {
    return location.pathname.startsWith(path);
  }, [location.pathname]);
  
  console.log('MobileNavigation: Rendering with language:', currentLanguage, 'renderKey:', renderKey);
  
  return (
    <motion.div 
      key={`nav-${renderKey}-${currentLanguage}`} // Force re-render on language change
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-background border-t border-muted",
        isTutorialActive && "opacity-30 pointer-events-none"
      )}
      style={{
        zIndex: 9998,
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
          const needsUpgrade = item.requiresPremium && !hasAccess && isTrialExpired;
          
          console.log(`MobileNavigation: Rendering nav item "${item.label}" for path ${item.path} with language ${currentLanguage}`);
          
          return (
            <Link
              key={`${item.path}-${renderKey}`}
              to={item.path}
              onClick={(e) => handleNavigation(item.path, e)}
              className={cn(
                "flex flex-col items-center py-1 transition-colors relative",
                isActive 
                  ? "text-primary" 
                  : needsUpgrade
                  ? "text-muted-foreground/50"
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              <div className="relative">
                <item.icon size={22} />
                {needsUpgrade && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                    <Lock className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                {isActive && !needsUpgrade && (
                  <motion.div
                    layoutId="mobileNavIndicator"
                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.3 }}
                  />
                )}
              </div>
              <span className={cn(
                "text-xs mt-0.5",
                needsUpgrade && "opacity-50"
              )}>
                <TranslatableText 
                  key={`${item.label}-${renderKey}-${currentLanguage}`}
                  text={item.label} 
                  forceTranslate={true}
                  onTranslationStart={() => console.log(`MobileNavigation: Translation started for "${item.label}" to ${currentLanguage}`)}
                  onTranslationEnd={() => console.log(`MobileNavigation: Translation completed for "${item.label}" to ${currentLanguage}`)}
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
