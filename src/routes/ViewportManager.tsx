
import React from 'react';
import { Outlet } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

const ViewportManager: React.FC = () => {
  const isMobile = useIsMobile();

  return (
    <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'} min-h-screen`}>
      <Outlet />
    </div>
  );
};

export default ViewportManager;
