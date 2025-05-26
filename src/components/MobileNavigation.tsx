
import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MessageCircle, BookOpen, BarChart2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isNativeApp } from '@/routes/RouteHelpers';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTutorial } from '@/contexts/TutorialContext';
import { useAuth } from '@/contexts/AuthContext';

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
    
    const shouldShowNav = (isMobile || isNativeApp()) && 
                          !isKeyboardVisible && 
                          !isOnboardingOrAuth &&
                          !!user &&
                          onboardingComplete !== false;
    
    setIsVisible(shouldShowNav);
  }, [location.pathname, isMobile, isKeyboardVisible, isTutorialActive, user, onboardingComplete]);
  
  if (!isVisible) {
    return null;
  }
  
  if (onboardingComplete === false || location.pathname === '/app') {
    return null;
  }
  
  // Navigation items with English text for translation
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
  
  return (
    <motion.div 
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-background border-t border-muted safe-area-bottom",
        isTutorialActive && "opacity-30 pointer-events-none"
      )}
      style={{
        zIndex: 9998,
        paddingTop: '8px',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        height: 'calc(60px + env(safe-area-inset-bottom))'
      }}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-around items-center px-2">
        {navItems.map((item) => {
          const isActive = getActiveStatus(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center py-1 px-2 transition-colors min-w-0 flex-1",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              <div className="relative mb-1">
                <item.icon size={20} />
                {isActive && (
                  <motion.div
                    layoutId="mobileNavIndicator"
                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.3 }}
                  />
                )}
              </div>
              <span className="text-xs text-center leading-tight">
                <TranslatableText 
                  text={item.label} 
                  forceTranslate={true}
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
