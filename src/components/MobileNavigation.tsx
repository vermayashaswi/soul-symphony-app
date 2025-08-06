
import React, { useEffect, useState, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MessageCircle, BookOpen, BarChart2, Settings, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isNativeApp, isAppRoute } from '@/routes/RouteHelpers';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTutorial } from '@/contexts/TutorialContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useSafeArea } from '@/hooks/use-safe-area';
import { useKeyboardDetection } from '@/hooks/use-keyboard-detection';
import { logger } from '@/utils/logger';

interface MobileNavigationProps {
  onboardingComplete: boolean | null;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ onboardingComplete }) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const { isActive: isTutorialActive, tutorialCompleted } = useTutorial();
  const { user } = useAuth();
  const { currentLanguage } = useTranslation();
  const { hasActiveSubscription, isTrialActive } = useSubscription();
  const { safeArea, isNative, isAndroid, applySafeAreaStyles } = useSafeArea();
  
  const { isKeyboardVisible, keyboardHeight, platform } = useKeyboardDetection();
  
  const navRef = useRef<HTMLDivElement>(null);
  const [renderKey, setRenderKey] = useState(0);
  
  const componentLogger = logger.createLogger('MobileNavigation');
  
  // Handle language changes
  useEffect(() => {
    const handleLanguageChange = () => {
      componentLogger.debug('Language change detected, forcing re-render');
      setRenderKey(prev => prev + 1);
    };
    
    window.addEventListener('languageChange', handleLanguageChange);
    return () => window.removeEventListener('languageChange', handleLanguageChange);
  }, []);
  
  // Apply safe area styles to the navigation element
  useEffect(() => {
    if (navRef.current) {
      applySafeAreaStyles(navRef.current);
      componentLogger.debug('Applied safe area styles', { safeArea });
    }
  }, [safeArea, applySafeAreaStyles]);
  
  // IMPROVED: Handle keyboard visibility with better coordination
  useEffect(() => {
    if (!navRef.current) return;
    
    const nav = navRef.current;
    
    // Prevent race conditions by ensuring only this component manages these classes
    nav.classList.toggle('keyboard-visible', isKeyboardVisible);
    nav.classList.toggle(`platform-${platform}`, true);
    
    // Debug attributes - DISABLED for production
    // nav.setAttribute('data-debug', 'true');
    nav.setAttribute('data-keyboard-visible', isKeyboardVisible.toString());
    nav.setAttribute('data-platform', platform);
    
    componentLogger.debug('Keyboard state applied', { 
      isVisible: isKeyboardVisible, 
      height: keyboardHeight, 
      platform,
      navHidden: isKeyboardVisible,
      elementClasses: nav.className
    });
  }, [isKeyboardVisible, keyboardHeight, platform]);
  
  // Enhanced visibility logic - aligned with ViewportManager
  useEffect(() => {
    const navigationHiddenPaths = [
      '/app/onboarding',
      '/app/auth',
      '/onboarding',
      '/auth'
    ];
    
    const shouldHideNavigation = navigationHiddenPaths.includes(location.pathname);
    const isTransitionalRoute = location.pathname === '/app' || location.pathname === '/';
    const isInAppContext = isAppRoute(location.pathname);
    
    // Show navigation if:
    // 1. We're in app context (app routes) - removed mobile-only restriction
    // 2. User is authenticated
    // 3. Not on hidden paths (onboarding/auth)  
    // 4. Onboarding is complete OR tutorial is complete OR we're not on a transitional route
    const shouldShowNav = isInAppContext &&
                          !!user &&
                          !shouldHideNavigation &&
                          (onboardingComplete || tutorialCompleted || !isTransitionalRoute);
    
    componentLogger.debug('Enhanced visibility check', { 
      shouldShowNav, 
      isMobile: isMobile.isMobile, 
      isNativeApp: isNativeApp(),
      path: location.pathname,
      isInAppContext,
      isKeyboardVisible,
      shouldHideNavigation,
      isTransitionalRoute,
      hasUser: !!user,
      onboardingComplete,
      tutorialCompleted,
      safeArea,
      isTutorialActive,
      note: 'Navigation now shows on all screen sizes within /app routes'
    });
    
    setIsVisible(shouldShowNav);
  }, [location.pathname, isMobile.isMobile, user, onboardingComplete, tutorialCompleted, currentLanguage, renderKey, safeArea]);
  
  if (!isVisible || onboardingComplete === false) {
    return null;
  }
  
  // Navigation items
  const navItems = [
    { path: '/app/home', icon: Home, label: 'Home', isPremium: false },
    { path: '/app/journal', icon: BookOpen, label: 'Journal', isPremium: false },
    { path: '/app/smart-chat', icon: MessageCircle, label: 'Chat', isPremium: true },
    { path: '/app/insights', icon: BarChart2, label: 'Insights', isPremium: true },
    { path: '/app/settings', icon: Settings, label: 'Settings', isPremium: false },
  ];

  const getActiveStatus = (path: string) => {
    // FIX: Use exact path matching to prevent multiple items appearing active
    return location.pathname === path;
  };
  
  const isPremiumFeatureAccessible = hasActiveSubscription || isTrialActive;
  
  return (
    <motion.div 
      ref={navRef}
      key={`nav-${renderKey}-${currentLanguage}`}
      className={cn(
        "mobile-navigation",
        isTutorialActive ? "tutorial-dimmed" : "",
        isAndroid && "platform-android",
        platform === 'ios' && "platform-ios"
        // Note: keyboard-visible class is managed by useKeyboardDetection hook
      )}
      initial={{ y: 100 }}
      animate={{ y: isVisible ? 0 : 100 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mobile-navigation-content">
        {navItems.map((item) => {
          const isActive = getActiveStatus(item.path);
          const isLocked = item.isPremium && !isPremiumFeatureAccessible;
          
          return (
            <Link
              key={`${item.path}-${renderKey}`}
              to={item.path}
              className={cn(
                "flex flex-col items-center py-1 transition-colors relative",
                isActive 
                  ? "text-primary" 
                  : isLocked
                  ? "text-muted-foreground/50"
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              <div className="relative">
                <item.icon size={22} />
                {isLocked && (
                  <Crown 
                    size={12} 
                    className="absolute -top-1 -right-1 text-orange-500 bg-background rounded-full p-0.5" 
                  />
                )}
                {isActive && (
                  <motion.div
                    layoutId={`mobileNavIndicator-${item.path}`}
                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.3 }}
                  />
                )}
              </div>
              <span className={cn(
                "text-xs mt-0.5 min-w-0 max-w-full",
                isLocked && "opacity-60"
              )}>
                <TranslatableText 
                  key={`${item.label}-${renderKey}-${currentLanguage}`}
                  text={item.label} 
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="mobile-nav"
                  className="block"
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
