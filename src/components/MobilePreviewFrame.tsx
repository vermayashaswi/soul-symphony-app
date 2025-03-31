
import React, { ReactNode, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface MobilePreviewFrameProps {
  children: ReactNode;
}

export const MobilePreviewFrame = ({ children }: MobilePreviewFrameProps) => {
  const location = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Ensure proper viewport configuration
  useEffect(() => {
    // Force proper viewport setup
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
    
    // Log for debugging
    console.log("MobilePreviewFrame mounted:", { 
      mobileDemo, 
      path: location.pathname,
      width: window.innerWidth,
      contentRef: contentRef.current
    });

    // Force visibility of content
    if (contentRef.current) {
      contentRef.current.style.display = 'block';
      contentRef.current.style.visibility = 'visible';
      contentRef.current.style.opacity = '1';
    }
  }, [mobileDemo, location]);
  
  // Add testing view if 'testing' parameter is true
  const isTesting = urlParams.get('testing') === 'true';
  const showMobileTestingView = isTesting && window.innerWidth < 768;

  // Only show the mobile frame if the mobileDemo parameter is true
  if (!mobileDemo) {
    return (
      <div ref={contentRef} style={{ display: 'block', visibility: 'visible', opacity: 1 }}>
        {children}
        {showMobileTestingView && <React.Suspense fallback={null}>
          {/* Load the MobileTestingView component only when needed */}
          {(() => {
            const MobileTestingView = React.lazy(() => import('./MobileTestingView'));
            return <MobileTestingView />;
          })()}
        </React.Suspense>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-800 p-4 overflow-auto">
      <div className="relative w-[375px] h-[812px] bg-white rounded-[40px] shadow-2xl overflow-hidden border-8 border-black">
        {/* Phone top notch */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-black z-10">
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-black rounded-b-lg"></div>
        </div>
        
        {/* Content area with scrolling */}
        <div 
          ref={contentRef}
          className="absolute top-6 left-0 right-0 bottom-6 overflow-auto bg-background"
          style={{ display: 'block', visibility: 'visible', opacity: 1 }}
        >
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
