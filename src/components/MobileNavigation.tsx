
import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MessageCircle, BookOpen, BarChart2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isNativeApp, isAppRoute } from '@/routes/RouteHelpers';
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
    // Detect keyboard visibility with multiple signals
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        // More aggressive detection threshold
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.75;
        setIsKeyboardVisible(isKeyboard);
      }
    };
    
    // Initial check
    handleVisualViewportResize();
    
    // Set up listeners for viewport changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      window.addEventListener('resize', handleVisualViewportResize);
    }
    
    // Set up listeners for keyboard events
    const handleKeyboardOpen = () => setIsKeyboardVisible(true);
    const handleKeyboardClose = () => setIsKeyboardVisible(false);
    
    window.addEventListener('keyboardOpen', handleKeyboardOpen);
    window.addEventListener('keyboardClose', handleKeyboardClose);
    
    // Clean up listeners
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
    // Always show mobile navigation for app routes in mobile or native app
    // Hide when keyboard is visible
    const shouldShowNav = (isMobile || isNativeApp()) && 
                          !isKeyboardVisible; 
    
    console.log('MobileNavigation visibility check:', { 
      shouldShowNav, 
      isMobile, 
      isNativeApp: isNativeApp(),
      path: location.pathname,
      isKeyboardVisible
    });
    
    setIsVisible(shouldShowNav);
  }, [location.pathname, isMobile, isKeyboardVisible]);
  
  if (!isVisible) {
    return null;
  }
  
  // Skip specific routes where nav doesn't make sense
  const hiddenRoutes = ['/auth', '/onboarding'];
    
  if (hiddenRoutes.includes(location.pathname)) {
    return null;
  }
  
  // Define navigation items with app path prefix
  const navItems = [
    { path: '/app/home', icon: Home, label: 'Home' },
    { path: '/app/journal', icon: BookOpen, label: 'Journal' },
    { path: '/app/smart-chat', icon: MessageCircle, label: 'Chat' },
    { path: '/app/insights', icon: BarChart2, label: 'Insights' },
    { path: '/app/settings', icon: Settings, label: 'Settings' },
  ];

  // Active status just needs to check current path
  const getActiveStatus = (path: string) => {
    return location.pathname.startsWith(path);
  };
  
  return (
    <motion.div 
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-muted p-2"
      style={{
        zIndex: 50, // Keep navbar below the input
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))'
      }}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
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
