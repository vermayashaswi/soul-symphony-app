
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
import { keyboardDetectionService, KeyboardState } from '@/services/keyboardDetectionService';

interface MobileNavigationProps {
  onboardingComplete: boolean | null;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ onboardingComplete }) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isVisible: false,
    height: 0,
    timestamp: Date.now()
  });
  const { isActive: isTutorialActive } = useTutorial();
  const { user } = useAuth();
  const { currentLanguage } = useTranslation();
  const { hasActiveSubscription, isTrialActive } = useSubscription();
  const { safeArea, isNative, isAndroid, applySafeAreaStyles } = useSafeArea();
  const navRef = useRef<HTMLDivElement>(null);
  
  const [renderKey, setRenderKey] = useState(0);
  
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
      
      if (isAndroid) {
        navRef.current.classList.add('debug');
      }
      
      console.log('MobileNavigation: Applied safe area styles:', safeArea, 'isAndroid:', isAndroid);
    }
  }, [safeArea, applySafeAreaStyles, isAndroid]);
  
  // Use centralized keyboard detection service
  useEffect(() => {
    const listenerId = 'mobile-navigation';
    
    keyboardDetectionService.addListener(listenerId, (state: KeyboardState) => {
      console.log('MobileNavigation: Keyboard state changed:', state);
      setKeyboardState(state);
    });
    
    return () => {
      keyboardDetectionService.removeListener(listenerId);
    };
  }, []);
  
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
                          !keyboardState.isVisible && 
                          !isOnboardingOrAuth &&
                          !!user &&
                          onboardingComplete !== false;
    
    console.log('MobileNavigation: Visibility check:', { 
      shouldShowNav, 
      isMobile, 
      isNativeApp: isNativeApp(),
      path: location.pathname,
      keyboardVisible: keyboardState.isVisible,
      keyboardHeight: keyboardState.height,
      isOnboardingOrAuth,
      hasUser: !!user,
      onboardingComplete,
      safeArea,
      isNative,
      isAndroid
    });
    
    setIsVisible(shouldShowNav);
  }, [location.pathname, isMobile, keyboardState, isTutorialActive, user, onboardingComplete, currentLanguage, renderKey, safeArea, isNative, isAndroid]);
  
  if (!isVisible) {
    return null;
  }
  
  if (onboardingComplete === false) {
    console.log('MobileNavigation: Not rendering due to onboarding status');
    return null;
  }
  
  // Navigation items with English text for translation
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
  
  // Calculate dynamic styles with improved Android handling
  const navigationStyle = {
    bottom: isAndroid ? `max(${safeArea.bottom}px, 8px)` : `${safeArea.bottom}px`,
    left: `${safeArea.left}px`,
    right: `${safeArea.right}px`,
    height: isAndroid ? `calc(4rem + max(${safeArea.bottom}px, 8px))` : `calc(4rem + ${safeArea.bottom}px)`,
    paddingBottom: isAndroid ? `max(${safeArea.bottom}px, 8px)` : `${safeArea.bottom}px`,
    zIndex: 9999,
    transform: 'translateZ(0)', // Force GPU acceleration
  };
  
  console.log('MobileNavigation: Rendering with styles:', navigationStyle, 'keyboard:', keyboardState);
  
  return (
    <motion.div 
      ref={navRef}
      key={`nav-${renderKey}-${currentLanguage}`}
      className={cn(
        "mobile-navigation",
        isTutorialActive && "opacity-30 pointer-events-none",
        isAndroid && "platform-android"
      )}
      style={navigationStyle}
      initial={{ y: 100, opacity: 0 }}
      animate={{ 
        y: 0, 
        opacity: 1,
        transition: { duration: 0.3, ease: "easeOut" }
      }}
      exit={{ 
        y: 100, 
        opacity: 0,
        transition: { duration: 0.2 }
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
