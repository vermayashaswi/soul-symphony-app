
import React, { ReactNode, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobilePreviewFrameProps {
  children: ReactNode;
}

const MobilePreviewFrame = ({ children }: MobilePreviewFrameProps) => {
  const isMobile = useIsMobile();
  
  // Get mobileDemo parameter from URL
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  // Apply iOS-specific meta tags when in mobile preview mode
  useEffect(() => {
    if (mobileDemo) {
      // Set iOS-specific meta tags
      const metaViewport = document.querySelector('meta[name="viewport"]');
      if (metaViewport) {
        metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
      }
      
      // Add iOS status bar meta tags
      if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
        const appleMobileWebAppCapable = document.createElement('meta');
        appleMobileWebAppCapable.name = 'apple-mobile-web-app-capable';
        appleMobileWebAppCapable.content = 'yes';
        document.head.appendChild(appleMobileWebAppCapable);
      }
      
      return () => {
        // Clean up iOS-specific meta tags when unmounting
        if (metaViewport) {
          metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
        }
        
        const appleMobileWebAppCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
        if (appleMobileWebAppCapable) {
          appleMobileWebAppCapable.remove();
        }
      };
    }
  }, [mobileDemo]);
  
  // Only show the mobile frame if the mobileDemo parameter is true
  if (!mobileDemo) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-800 p-4 overflow-auto">
      <div className="relative w-[375px] h-[812px] bg-white rounded-[40px] shadow-2xl overflow-hidden border-8 border-black">
        {/* Phone top notch - iPhone style */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-black z-10">
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-black rounded-b-lg"></div>
        </div>
        
        {/* Content area with scrolling - ensure iOS-like behavior */}
        <div className="absolute top-6 left-0 right-0 bottom-6 overflow-auto bg-background -webkit-overflow-scrolling-touch">
          {children}
        </div>
        
        {/* Phone bottom bar - iPhone home indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-black z-10">
          <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-gray-400 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default MobilePreviewFrame;
