
import { Home, Book, BarChart2, MessageSquare, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';

const MobileNavbar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const navItems = [
    { path: '/home', label: 'Home', icon: Home },
    { path: '/journal', label: 'Journal', icon: Book },
    { path: '/insights', label: 'Insights', icon: BarChart2 },
    { path: '/smart-chat', label: 'Chat', icon: MessageSquare },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  // Only show the navbar if the user is logged in or on the home page
  if (!user && location.pathname !== '/') {
    return null;
  }
  
  // Listen for keyboard visibility changes
  useEffect(() => {
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
    
    // Custom event for keyboard visibility
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

  // Return null when keyboard is visible
  if (isKeyboardVisible) {
    return null;
  }

  // Improved active route detection to ensure only one tab is active
  const getActiveStatus = (path: string) => {
    // Exact path matching to ensure only one active tab
    return location.pathname === path;
  };

  return (
    <motion.div 
      className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-muted flex items-center justify-around z-50 px-1 backdrop-blur-sm"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {navItems.map(item => {
        const isActive = getActiveStatus(item.path);
        
        return (
          <Link 
            key={item.path} 
            to={item.path}
            className="flex flex-col items-center justify-center w-full h-full pt-1"
          >
            <div className="relative">
              {isActive && (
                <motion.div
                  layoutId="nav-pill-mobile"
                  className="absolute -inset-1 bg-theme/20 rounded-full"
                  transition={{ type: "spring", duration: 0.6 }}
                />
              )}
              <item.icon className={cn(
                "relative h-5 w-5 transition-colors duration-200",
                isActive ? "text-theme" : "text-muted-foreground"
              )} />
            </div>
            <span className={cn(
              "text-xs mt-1 transition-colors duration-200",
              isActive ? "text-theme font-medium" : "text-muted-foreground"
            )}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </motion.div>
  );
};

export default MobileNavbar;
