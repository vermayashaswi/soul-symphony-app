
import React, { useEffect, useState } from 'react';
import { useMobile } from '@/hooks/use-mobile';
import MobileNavigation from '@/components/MobileNavigation';

interface ViewportManagerProps {
  children: React.ReactNode;
}

const ViewportManager: React.FC<ViewportManagerProps> = ({ children }) => {
  const { isMobile } = useMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
      {isMobile && <MobileNavigation />}
    </div>
  );
};

export default ViewportManager;
