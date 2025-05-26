
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Home, 
  BookOpen, 
  MessageSquare, 
  BarChart3, 
  Settings 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { TranslatableText } from '@/components/translation/TranslatableText';

const MobileNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isActive: isTutorialActive } = useTutorial();

  // Don't show navigation on auth/onboarding pages or when not authenticated
  const isOnboardingOrAuth = 
    location.pathname === '/app/onboarding' || 
    location.pathname === '/app/auth' ||
    location.pathname === '/onboarding' ||
    location.pathname === '/auth' ||
    location.pathname === '/app' ||
    location.pathname === '/';

  if (isOnboardingOrAuth || !user) {
    return null;
  }

  const navItems = [
    { 
      icon: Home, 
      label: 'Home', 
      path: '/app/home',
      tutorialId: 'nav-home'
    },
    { 
      icon: BookOpen, 
      label: 'Journal', 
      path: '/app/journal',
      tutorialId: 'nav-journal'
    },
    { 
      icon: MessageSquare, 
      label: 'Chat', 
      path: '/app/chat',
      tutorialId: 'nav-chat'
    },
    { 
      icon: BarChart3, 
      label: 'Insights', 
      path: '/app/insights',
      tutorialId: 'nav-insights'
    },
    { 
      icon: Settings, 
      label: 'Settings', 
      path: '/app/settings',
      tutorialId: 'nav-settings'
    },
  ];

  const isActive = (path: string) => {
    return location.pathname === path || 
           (path === '/app/home' && location.pathname === '/app');
  };

  return (
    <motion.nav
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t z-40 safe-area-bottom",
        isTutorialActive && "opacity-30 pointer-events-none"
      )}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-around items-center py-2 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 min-w-[60px]",
                active
                  ? "text-theme-color bg-theme-color/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
              data-tutorial-id={item.tutorialId}
            >
              <Icon 
                className={cn(
                  "h-5 w-5 mb-1 transition-all duration-200",
                  active && "scale-110"
                )} 
              />
              <span className={cn(
                "text-xs font-medium transition-all duration-200",
                active && "font-semibold"
              )}>
                <TranslatableText text={item.label} forceTranslate={true} />
              </span>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
};

export default MobileNavigation;
