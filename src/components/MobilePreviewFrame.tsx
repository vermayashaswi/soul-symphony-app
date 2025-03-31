
import React, { ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface MobilePreviewFrameProps {
  children: ReactNode;
}

export const MobilePreviewFrame = ({ children }: MobilePreviewFrameProps) => {
  const location = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  useEffect(() => {
    if (mobileDemo) {
      // When in mobile preview mode, force the viewport meta tag
      const metaViewport = document.querySelector('meta[name="viewport"]');
      if (metaViewport) {
        metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }
      
      // Set the body style to prevent scrolling outside the frame
      document.body.style.overflow = 'hidden';
      document.body.style.backgroundColor = '#1e293b'; // slate-800
      
      // Expose the mobile view flag for other components
      window.__forceMobileView = true;
      
      console.log('Mobile preview frame activated');
    }
    
    return () => {
      if (mobileDemo) {
        document.body.style.overflow = '';
        document.body.style.backgroundColor = '';
        window.__forceMobileView = undefined;
        console.log('Mobile preview frame deactivated');
      }
    };
  }, [mobileDemo]);
  
  // Only show the mobile frame if the mobileDemo parameter is true
  if (!mobileDemo) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-800 p-4 overflow-auto">
      <div className="relative w-[375px] h-[812px] bg-white rounded-[40px] shadow-2xl overflow-hidden border-8 border-black">
        {/* Phone top notch */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-black z-10">
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-black rounded-b-lg"></div>
        </div>
        
        {/* Content area with scrolling */}
        <div className="absolute top-6 left-0 right-0 bottom-6 overflow-auto bg-background">
          {children}
        </div>
        
        {/* Phone bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-black z-10">
          <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-gray-400 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default MobilePreviewFrame;
