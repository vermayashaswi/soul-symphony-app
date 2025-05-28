
import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { useMobile } from '@/hooks/use-mobile';
import MobileNavigation from '@/components/MobileNavigation';

interface ViewportManagerProps {
  children: React.ReactNode;
}

const ViewportManager: React.FC<ViewportManagerProps> = ({ children }) => {
  const { isMobile } = useMobile();
  const location = useLocation();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Check if we should show mobile navigation
  // Only show on main app routes, not on onboarding, auth, or website routes
  const shouldShowMobileNav = isMobile && 
    location.pathname.startsWith('/app/') && 
    location.pathname !== '/app/onboarding' && 
    location.pathname !== '/app/auth';

  console.log('ViewportManager:', { 
    currentPath: location.pathname, 
    isMobile, 
    shouldShowMobileNav 
  });

  return (
    <div className="min-h-screen bg-background">
      {children}
      {shouldShowMobileNav && <MobileNavigation />}
    </div>
  );
};

export default ViewportManager;
