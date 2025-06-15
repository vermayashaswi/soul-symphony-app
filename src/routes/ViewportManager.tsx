
import React, { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ViewportManagerProps {
  children: ReactNode;
}

const ViewportManager: React.FC<ViewportManagerProps> = ({ children }) => {
  const isMobile = useIsMobile();

  return (
    <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} min-h-screen`}>
      {children}
    </div>
  );
};

export default ViewportManager;
