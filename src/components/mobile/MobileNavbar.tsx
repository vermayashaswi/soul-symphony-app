
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  User, 
  MessageSquare, 
  LineChart 
} from 'lucide-react';
import SouloLogo from '@/components/SouloLogo';
import { cn } from '@/lib/utils';
import { useTutorial } from '@/contexts/TutorialContext';

const MobileNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isActive: isTutorialActive } = useTutorial();

  // Enhanced check for onboarding or auth routes - make consistent with other components
  const isOnboardingOrAuth = 
    location.pathname === '/app/onboarding' || 
    location.pathname === '/app/auth' ||
    location.pathname === '/onboarding' ||
    location.pathname === '/auth' ||
    location.pathname === '/app' ||
    location.pathname === '/'; // Don't show on root path either
  
  // Don't render if we're on onboarding/auth screens
  if (isOnboardingOrAuth) {
    console.log('MobileNavbar: Not rendering on onboarding/auth route:', location.pathname);
    return null;
  }

  return (
    <motion.nav
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t px-4 py-2",
        isTutorialActive && "opacity-30 pointer-events-none" // Fade out and disable interaction during tutorial
      )}
      style={{
        zIndex: 9998, // Lower z-index than tutorial overlay (9999)
      }}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-between items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          className="p-0" 
          onClick={() => navigate('/')}
        >
          <SouloLogo size="small" useColorTheme={true} />
        </Button>

        <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
          <User className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}>
          <MessageSquare className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => navigate('/insights')}>
          <LineChart className="h-5 w-5" />
        </Button>
      </div>
    </motion.nav>
  );
};

export default MobileNavbar;
