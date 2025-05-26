
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

  // Helper function to determine if text is likely to be long (for translation-aware styling)
  const isLongText = (text: string) => {
    return text.length > 8;
  };
  
  return (
    <motion.div 
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-background border-t border-muted safe-area-bottom",
        isTutorialActive && "opacity-30 pointer-events-none"
      )}
      style={{
        zIndex: 9998,
        paddingTop: '6px',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
        height: 'calc(58px + env(safe-area-inset-bottom))'
      }}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-around items-center px-1">
        {navItems.map((item) => {
          const isActive = getActiveStatus(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-1 transition-colors min-w-0 flex-1",
                "hover:bg-muted/50 rounded-md",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              <div className="relative mb-0.5 flex-shrink-0">
                <item.icon size={18} className="flex-shrink-0" />
                {isActive && (
                  <motion.div
                    layoutId="mobileNavIndicator"
                    className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.3 }}
                  />
                )}
              </div>
              <div className="text-center w-full min-h-[2.5rem] flex items-center justify-center">
                <TranslatableText 
                  text={item.label} 
                  forceTranslate={true}
                  className={cn(
                    "leading-tight font-medium transition-all duration-200",
                    // Responsive font sizing
                    "text-[10px] sm:text-xs",
                    // Text truncation and wrapping
                    "max-w-full break-words hyphens-auto",
                    // Dynamic spacing based on potential text length
                    isLongText(item.label) && "text-[9px] sm:text-[10px] leading-[1.1]",
                    // Better letter spacing for readability
                    "tracking-tight"
                  )}
                  style={{
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    textAlign: 'center',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: isLongText(item.label) ? '1.1' : '1.2'
                  }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
};

export default MobileNavigation;
