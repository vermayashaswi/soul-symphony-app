
import { Home, Book, BarChart2, MessageSquare, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const MobileNavbar = () => {
  const location = useLocation();
  const { user } = useAuth();
  
  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/journal', label: 'Journal', icon: Book },
    { path: '/insights', label: 'Insights', icon: BarChart2 },
    { path: '/smart-chat', label: 'Chat', icon: MessageSquare },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  // Only show the navbar if the user is logged in or on the home page
  if (!user && location.pathname !== '/') {
    return null;
  }

  return (
    <motion.div 
      className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t flex items-center justify-around z-50 px-1"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {navItems.map(item => {
        const isActive = location.pathname === item.path;
        
        return (
          <Link 
            key={item.path} 
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full pt-1",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
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
