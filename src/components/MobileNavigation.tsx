
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

interface MobileNavigationProps {
  onboardingComplete: boolean | null;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ onboardingComplete }) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const { isActive: isTutorialActive } = useTutorial();
  const { user } = useAuth();
  const { currentLanguage } = useTranslation();
  const { hasActiveSubscription, isTrialActive } = useSubscription();
  const { safeArea, isNative, isAndroid, applySafeAreaStyles } = useSafeArea();
  
  const { isKeyboardVisible, keyboardHeight, platform, isReady } = useKeyboardDetection();
  
  const navRef = useRef<HTMLDivElement>(null);
  const [renderKey, setRenderKey] = useState(0);
  
  // Handle language changes
  useEffect(() => {
    const handleLanguageChange = () => {
      console.log('MobileNavigation: Language change detected, forcing re-render');
      setRenderKey(prev => prev + 1);
    };
    
    window.addEventListener('languageChange', handleLanguageChange);
    return () => window.removeEventListener('languageChange', handleLanguageChange);
  }, []);
  
  // Apply safe area styles to the navigation element
  useEffect(() => {
    if (navRef.current) {
      applySafeAreaStyles(navRef.current);
      console.log('MobileNavigation: Applied safe area styles:', safeArea);
    }
  }, [safeArea, applySafeAreaStyles]);
  
  // Enhanced keyboard visibility handling with better coordination
  useEffect(() => {
    if (!navRef.current || !isReady) return;
    
    const nav = navRef.current;
    
    // Apply keyboard state classes
    nav.classList.toggle('keyboard-visible', isKeyboardVisible);
    nav.setAttribute('data-keyboard-visible', isKeyboardVisible.toString());
    nav.setAttribute('data-keyboard-height', keyboardHeight.toString());
    
    console.log('MobileNavigation: Keyboard state changed:', { 
      isVisible: isKeyboardVisible, 
      height: keyboardHeight, 
      platform,
      navElement: nav.className,
      navTransform: getComputedStyle(nav).transform,
      navBottom: getComputedStyle(nav).bottom
    });
    
    // Force a style recalculation to ensure CSS changes are applied
    if (isKeyboardVisible) {
      nav.style.transform = 'translateY(100%)';
    } else {
      nav.style.transform = '';
    }
    
  }, [isKeyboardVisible, keyboardHeight, platform, isReady]);
  
  // Visibility logic - enhanced to work better with keyboard detection
  useEffect(() => {
    const onboardingOrAuthPaths = [
      '/app/onboarding',
      '/app/auth',
      '/onboarding',
      '/auth',
      '/'
    ];
    
    const isOnboardingOrAuth = onboardingOrAuthPaths.includes(location.pathname);
    
    // Navigation should be visible when all conditions are met AND keyboard is not visible
    const shouldShowNav = (isMobile.isMobile || isNativeApp()) && 
                          !isOnboardingOrAuth &&
                          !!user &&
                          onboardingComplete !== false &&
                          isReady; // Wait for keyboard detection to be ready
    
    console.log('MobileNavigation: Visibility check:', { 
      shouldShowNav, 
      isMobile: isMobile.isMobile, 
      isNativeApp: isNativeApp(),
      path: location.pathname,
      isKeyboardVisible,
      isOnboardingOrAuth,
      hasUser: !!user,
      onboardingComplete,
      isReady,
      safeArea
    });
    
    setIsVisible(shouldShowNav);
  }, [location.pathname, isMobile.isMobile, isKeyboardVisible, isTutorialActive, user, onboardingComplete, currentLanguage, renderKey, safeArea, isReady]);
  
  // Don't render if not visible or onboarding incomplete
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
    return location.pathname.startsWith(path);
  };
  
  const isPremiumFeatureAccessible = hasActiveSubscription || isTrialActive;
  
  return (
    <motion.div 
      ref={navRef}
      key={`nav-${renderKey}-${currentLanguage}`}
      className={cn(
        "mobile-navigation",
        isTutorialActive && "opacity-30 pointer-events-none",
        isAndroid && "platform-android",
        platform === 'ios' && "platform-ios",
        isKeyboardVisible && "keyboard-visible"
      )}
      initial={{ y: 100 }}
      animate={{ y: isKeyboardVisible ? 100 : 0 }} // Explicit animation control
      transition={{ duration: 0.15, ease: "easeInOut" }}
      style={{
        // Inline styles for immediate effect during keyboard transitions
        transform: isKeyboardVisible ? 'translateY(100%)' : 'translateY(0)',
        transition: 'transform 0.15s ease-in-out'
      }}
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
                    layoutId="mobileNavIndicator"
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
