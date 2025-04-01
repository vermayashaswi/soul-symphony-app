
import React, { ReactNode } from 'react';

interface MobilePreviewFrameProps {
  children: ReactNode;
}

const MobilePreviewFrame = ({ children }: MobilePreviewFrameProps) => {
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
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
