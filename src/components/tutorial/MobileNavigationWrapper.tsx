
import React from 'react';
import MobileNavigation from '../MobileNavigation';
import { useLocation } from 'react-router-dom';

interface MobileNavigationWrapperProps {
  onboardingComplete: boolean | null;
}

const MobileNavigationWrapper: React.FC<MobileNavigationWrapperProps> = ({ onboardingComplete }) => {
  const location = useLocation();
  
  // This component adds the necessary tutorial IDs to the nav buttons
  // by inserting divs with IDs at the exact positions through absolute positioning
  
  return (
    <>
      {/* Tutorial target elements */}
      <div id="chat-nav-button" className="fixed bottom-[14px] left-[calc(50%-60px)] w-12 h-12 z-[9998] pointer-events-none" />
      <div id="insights-nav-button" className="fixed bottom-[14px] right-[calc(25%-6px)] w-12 h-12 z-[9998] pointer-events-none" />
      
      {/* Original MobileNavigation */}
      <MobileNavigation onboardingComplete={onboardingComplete} />
    </>
  );
};

export default MobileNavigationWrapper;
