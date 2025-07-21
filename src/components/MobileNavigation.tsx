
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
  const { hasActiveSubscription, isTrialActive } = useSubscription();
  const { safeArea, isNative, isAndroid, applySafeAreaStyles } = useSafeArea();
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
  
  // Keyboard detection
  useEffect(() => {
    const handleKeyboardDetection = () => {
      if (window.visualViewport) {
        const heightDifference = window.innerHeight - window.visualViewport.height;
        const isKeyboard = heightDifference > 150; // More reliable threshold
        
        if (isKeyboard !== isKeyboardVisible) {
          setIsKeyboardVisible(isKeyboard);
          console.log('MobileNavigation: Keyboard visibility changed:', isKeyboard);
          
          // Dispatch events for other components
          const eventName = isKeyboard ? 'keyboardOpen' : 'keyboardClose';
          window.dispatchEvent(new Event(eventName));
        }
      }
    };
    
    // Initial check
    handleKeyboardDetection();
    
    // Set up listeners
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleKeyboardDetection);
    }
    window.addEventListener('resize', handleKeyboardDetection);
    
    // Custom event listeners
    const handleKeyboardOpen = () => setIsKeyboardVisible(true);
    const handleKeyboardClose = () => setIsKeyboardVisible(false);
    
    window.addEventListener('keyboardOpen', handleKeyboardOpen);
    window.addEventListener('keyboardClose', handleKeyboardClose);
    
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleKeyboardDetection);
      }
      window.removeEventListener('resize', handleKeyboardDetection);
      window.removeEventListener('keyboardOpen', handleKeyboardOpen);
      window.removeEventListener('keyboardClose', handleKeyboardClose);
    };
  }, [isKeyboardVisible]);
  
  // Visibility logic
  useEffect(() => {
    const onboardingOrAuthPaths = [
      '/app/onboarding',
      '/app/auth',
      '/onboarding',
      '/auth',
      '/'
    ];
    
    const isOnboardingOrAuth = onboardingOrAuthPaths.includes(location.pathname);
    
    const shouldShowNav = (isMobile || isNativeApp()) && 
                          !isOnboardingOrAuth &&
                          !!user &&
                          onboardingComplete !== false;
    
    console.log('MobileNavigation: Visibility check:', { 
      shouldShowNav, 
      isMobile, 
      isNativeApp: isNativeApp(),
      path: location.pathname,
      isKeyboardVisible,
      isOnboardingOrAuth,
      hasUser: !!user,
      onboardingComplete,
      safeArea
    });
    
    setIsVisible(shouldShowNav);
  }, [location.pathname, isMobile, isKeyboardVisible, isTutorialActive, user, onboardingComplete, currentLanguage, renderKey, safeArea]);
  
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
  
  console.log('MobileNavigation: Rendering with:', { safeArea, isAndroid, isKeyboardVisible });
  
  return (
    <motion.div 
      ref={navRef}
      key={`nav-${renderKey}-${currentLanguage}`}
      className={cn(
        "mobile-navigation",
        isTutorialActive && "opacity-30 pointer-events-none",
        isAndroid && "platform-android",
        isKeyboardVisible && "keyboard-visible"
      )}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
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
