
import { Home, Book, BarChart2, MessageSquare, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

const MobileNavbar = () => {
  const { user } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>('/');
  
  useEffect(() => {
    // Get initial path
    setCurrentPath(window.location.pathname);
    
    // Listen for path changes
    const handlePathnameChange = () => {
      setCurrentPath(window.location.pathname);
    };
    
    window.addEventListener('popstate', handlePathnameChange);
    
    // Custom event for route changes via Link component
    const handleRouteChange = () => {
      setTimeout(() => {
        setCurrentPath(window.location.pathname);
      }, 50);
    };
    
    window.addEventListener('routeChange', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handlePathnameChange);
      window.removeEventListener('routeChange', handleRouteChange);
    };
  }, []);
  
  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/journal', label: 'Journal', icon: Book },
    { path: '/insights', label: 'Insights', icon: BarChart2 },
    { path: '/smart-chat', label: 'Chat', icon: MessageSquare },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  // Only show the navbar if the user is logged in or on the home page
  if (!user && currentPath !== '/') {
    return null;
  }

  // Get mobileDemo parameter from current URL if present
  const preserveMobileParam = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mobileDemo = urlParams.get('mobileDemo');
    
    if (mobileDemo === 'true') {
      return '?mobileDemo=true';
    }
    return '';
  };
  
  const mobileParam = preserveMobileParam();

  return (
    <motion.div 
      className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t flex items-center justify-around z-50 px-1"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {navItems.map(item => {
        const isActive = currentPath === item.path;
        // Only preserve mobileDemo parameter if it's already present in the URL
        const navUrl = `${item.path}${mobileParam}`;
        
        return (
          <Link 
            key={item.path} 
            to={navUrl}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full pt-1",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
            onClick={() => {
              // Dispatch a custom event that we can listen to for route changes
              window.dispatchEvent(new CustomEvent('routeChange'));
            }}
          >
            <div className="relative">
              {isActive && (
                <motion.div
                  layoutId="nav-pill-mobile"
                  className="absolute -inset-1 bg-primary/10 rounded-full"
                  transition={{ type: "spring", duration: 0.6 }}
                />
              )}
              <item.icon className="relative h-5 w-5" />
            </div>
            <span className="text-xs mt-1">{item.label}</span>
          </Link>
        );
      })}
    </motion.div>
  );
};

export default MobileNavbar;
