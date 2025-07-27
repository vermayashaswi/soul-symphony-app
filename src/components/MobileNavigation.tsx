
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

const MobileNavigation: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const { isActive: isTutorialActive } = useTutorial();
  const { user } = useAuth();
  const { currentLanguage } = useTranslation();
  const { hasActiveSubscription, isTrialActive } = useSubscription();
  const { safeArea, isNative, isAndroid, applySafeAreaStyles } = useSafeArea();
  
  const { isKeyboardVisible, keyboardHeight, platform } = useKeyboardDetection();
  
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
  
  // IMPROVED: Handle keyboard visibility with better coordination
  useEffect(() => {
    if (!navRef.current) return;
    
    const nav = navRef.current;
    
    // Prevent race conditions by ensuring only this component manages these classes
    nav.classList.toggle('keyboard-visible', isKeyboardVisible);
    nav.classList.toggle(`platform-${platform}`, true);
    
    // Add debug attributes for visual debugging
    nav.setAttribute('data-debug', 'true');
    nav.setAttribute('data-keyboard-visible', isKeyboardVisible.toString());
    nav.setAttribute('data-platform', platform);
    
    console.log('[MobileNavigation] Keyboard state applied:', { 
      isVisible: isKeyboardVisible, 
      height: keyboardHeight, 
      platform,
      navHidden: isKeyboardVisible,
      elementClasses: nav.className
    });
  }, [isKeyboardVisible, keyboardHeight, platform]);
  
  // Visibility logic - hide when keyboard is visible or on auth/onboarding pages
  useEffect(() => {
    const onboardingOrAuthPaths = [
      '/app/onboarding',
      '/app/auth',
      '/onboarding',
      '/auth',
      '/'
    ];
    
    const isOnboardingOrAuth = onboardingOrAuthPaths.includes(location.pathname);
    
    const shouldShowNav = (isMobile.isMobile || isNativeApp()) && 
                          !isOnboardingOrAuth &&
                          !!user;
    
    console.log('[MobileNavigation] Visibility check:', { 
      shouldShowNav, 
      isMobile: isMobile.isMobile, 
      isNativeApp: isNativeApp(),
      path: location.pathname,
      isKeyboardVisible,
      isOnboardingOrAuth,
      hasUser: !!user,
      safeArea
    });
    
    setIsVisible(shouldShowNav);
  }, [location.pathname, isMobile.isMobile, isKeyboardVisible, isTutorialActive, user, currentLanguage, renderKey, safeArea]);
  
  if (!isVisible) {
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
        isTutorialActive && "opacity-30 pointer-events-none",
        isAndroid && "platform-android",
        platform === 'ios' && "platform-ios"
        // Note: keyboard-visible class is managed by useKeyboardDetection hook
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
