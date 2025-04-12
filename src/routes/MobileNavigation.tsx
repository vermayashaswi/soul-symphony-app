
import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MessageCircle, BookOpen, BarChart2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isNativeApp, isAppRoute } from './RouteHelpers';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileNavigationProps {
  onboardingComplete: boolean | null;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ onboardingComplete }) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  useEffect(() => {
    // Detect keyboard visibility
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.8;
        setIsKeyboardVisible(isKeyboard);
      }
    };
    
    // Initial check
    handleVisualViewportResize();
    
    // Set up listeners
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      window.addEventListener('resize', handleVisualViewportResize);
    }
    
    // Clean up listeners
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.removeEventListener('resize', handleVisualViewportResize);
      }
    };
  }, []);
  
  useEffect(() => {
    // Only show mobile navigation for app routes in mobile or native app and when authenticated
    const shouldShowNav = (isMobile || isNativeApp()) && 
                          isAppRoute(location.pathname) &&
                          onboardingComplete !== false &&
                          !isKeyboardVisible; // Hide when keyboard is visible
    
    console.log('MobileNavigation visibility check:', { 
      shouldShowNav, 
      isMobile, 
      isNativeApp: isNativeApp(),
      isAppRoute: isAppRoute(location.pathname),
      path: location.pathname,
      onboardingComplete 
    });
    
    setIsVisible(shouldShowNav);
  }, [location.pathname, isMobile, onboardingComplete, isKeyboardVisible]);
  
  if (!isVisible) {
    return null;
  }
  
  // Skip specific routes where nav doesn't make sense
  const hiddenRoutes = ['/app/auth', '/app', '/app/onboarding'];
  if (hiddenRoutes.includes(location.pathname)) {
    return null;
  }
  
  const navItems = [
    { path: '/app/home', icon: Home, label: 'Home' },
    { path: '/app/journal', icon: BookOpen, label: 'Journal' },
    { path: '/app/smart-chat', icon: MessageCircle, label: 'Chat' },
    { path: '/app/insights', icon: BarChart2, label: 'Insights' },
    { path: '/app/settings', icon: Settings, label: 'Settings' },
  ];

  // Improved active route detection for handling back navigation
  const getActiveStatus = (path: string) => {
    // Strict exact path matching
    return location.pathname === path;
  };
  
  return (
    <motion.div 
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-muted p-2 z-50"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          // Use the new active status function
          const isActive = getActiveStatus(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center p-2 transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              <div className="relative">
                <item.icon size={24} />
                {isActive && (
                  <motion.div
                    layoutId="mobileNavIndicator"
                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.3 }}
                  />
                )}
              </div>
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
};

export default MobileNavigation;
