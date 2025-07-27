import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MessageCircle, BookOpen, BarChart2, Settings, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTutorial } from '@/contexts/TutorialContext';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useSimpleOnboarding } from '@/hooks/useSimpleOnboarding';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useSafeArea } from '@/hooks/use-safe-area';
import { useKeyboardDetection } from '@/hooks/use-keyboard-detection';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

const OptimizedMobileNavigation: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const { isActive: isTutorialActive } = useTutorial();
  const { isAuthenticated, quickAuthCheck } = useOptimizedAuth();
  const { onboardingComplete } = useSimpleOnboarding();
  const { hasActiveSubscription, isTrialActive } = useSubscription();
  const { safeArea, applySafeAreaStyles } = useSafeArea();
  const { isKeyboardVisible } = useKeyboardDetection();
  
  const navRef = useRef<HTMLDivElement>(null);

  // Memoized navigation items
  const navItems = useMemo(() => [
    { path: '/app/home', icon: Home, label: 'Home', isPremium: false },
    { path: '/app/journal', icon: BookOpen, label: 'Journal', isPremium: false },
    { path: '/app/smart-chat', icon: MessageCircle, label: 'Chat', isPremium: true },
    { path: '/app/insights', icon: BarChart2, label: 'Insights', isPremium: true },
    { path: '/app/settings', icon: Settings, label: 'Settings', isPremium: false },
  ], []);

  // Optimized visibility logic using localStorage for immediate responsiveness
  const shouldShowNavigation = useMemo(() => {
    const excludedPaths = ['/app/onboarding', '/app/auth', '/onboarding', '/auth', '/'];
    const isExcludedPath = excludedPaths.includes(location.pathname);
    
    // Quick check using localStorage for immediate UI response
    const hasAuth = isAuthenticated || quickAuthCheck.hasStoredAuth;
    const hasCompletedOnboarding = onboardingComplete !== false;
    
    // Must be mobile/native and have auth and completed onboarding
    const shouldShow = (isMobile.isMobile || nativeIntegrationService.isRunningNatively()) && 
                     !isExcludedPath &&
                     hasAuth &&
                     hasCompletedOnboarding &&
                     !isKeyboardVisible;

    console.log('[OptimizedMobileNav] Visibility check:', {
      shouldShow,
      isMobile: isMobile.isMobile,
      isNative: nativeIntegrationService.isRunningNatively(),
      path: location.pathname,
      isExcludedPath,
      hasAuth,
      quickAuth: quickAuthCheck.hasStoredAuth,
      hasCompletedOnboarding,
      isKeyboardVisible
    });

    return shouldShow;
  }, [
    location.pathname,
    isMobile.isMobile,
    isAuthenticated,
    quickAuthCheck.hasStoredAuth,
    onboardingComplete,
    isKeyboardVisible
  ]);

  // Apply safe area styles
  useEffect(() => {
    if (navRef.current) {
      applySafeAreaStyles(navRef.current);
    }
  }, [safeArea, applySafeAreaStyles]);

  // Update visibility
  useEffect(() => {
    setIsVisible(shouldShowNavigation);
  }, [shouldShowNavigation]);

  const getActiveStatus = (path: string) => {
    return location.pathname === path;
  };
  
  const isPremiumFeatureAccessible = hasActiveSubscription || isTrialActive;

  if (!isVisible) {
    return null;
  }

  return (
    <motion.div 
      ref={navRef}
      className={cn(
        "mobile-navigation",
        isTutorialActive && "opacity-30 pointer-events-none"
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
              key={item.path}
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

export default OptimizedMobileNavigation;