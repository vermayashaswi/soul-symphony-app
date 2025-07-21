
import React, { useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MessageCircle, BookOpen, BarChart2, Settings, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isNativeApp } from '@/routes/RouteHelpers';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTutorial } from '@/contexts/TutorialContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useSafeAreaUnified } from '@/hooks/use-safe-area-unified';
import { useKeyboardDetection } from '@/hooks/use-keyboard-detection';

interface MobileNavigationProps {
  onboardingComplete: boolean | null;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ onboardingComplete }) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isActive: isTutorialActive } = useTutorial();
  const { user } = useAuth();
  const { hasActiveSubscription, isTrialActive } = useSubscription();
  const { safeArea, isNative, isAndroid, isInitialized } = useSafeAreaUnified();
  const { isKeyboardVisible } = useKeyboardDetection();
  const navRef = useRef<HTMLDivElement>(null);
  
  // Apply safe area styles to navigation
  useEffect(() => {
    if (navRef.current && isInitialized) {
      navRef.current.style.setProperty('--element-safe-area-bottom', `${safeArea.bottom}px`);
      navRef.current.style.setProperty('--element-safe-area-left', `${safeArea.left}px`);
      navRef.current.style.setProperty('--element-safe-area-right', `${safeArea.right}px`);
      
      console.log('[MobileNavigation] Applied safe area styles:', safeArea);
    }
  }, [safeArea, isInitialized]);
  
  // Determine visibility
  const shouldShow = (isMobile || isNativeApp()) && 
                    !isKeyboardVisible && 
                    !!user &&
                    onboardingComplete !== false &&
                    !location.pathname.includes('/onboarding') &&
                    !location.pathname.includes('/auth') &&
                    location.pathname !== '/';
  
  if (!shouldShow) {
    return null;
  }
  
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
      className={cn(
        "mobile-navigation",
        isTutorialActive && "opacity-30 pointer-events-none",
        isAndroid && "platform-android"
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
                <TranslatableText text={item.label} />
              </span>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
};

export default MobileNavigation;
