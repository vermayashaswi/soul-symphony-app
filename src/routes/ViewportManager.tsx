import React, { useState, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive';
import MobilePreviewFrame from '@/components/MobilePreviewFrame';

interface ViewportManagerProps {
  children: React.ReactNode;
}

const ViewportManager: React.FC<ViewportManagerProps> = ({ children }) => {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  useEffect(() => {
    // Set viewport meta tag dynamically based on device
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute('content', isMobile ? 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' : 'width=device-width, initial-scale=1');
    }
  }, [isMobile]);

  const renderContent = () => {
    // Mobile detection and viewport setup
    if (isMobile) {
      return (
        <div className="mobile-container">
          <MobilePreviewFrame>
            {children}
          </MobilePreviewFrame>
        </div>
      );
    }

    // Desktop/tablet view
    return (
      <div className="desktop-container">
        {children}
      </div>
    );
  };

  return (
    <div className="viewport-manager">
      {renderContent()}
    </div>
  );
};

export default ViewportManager;
