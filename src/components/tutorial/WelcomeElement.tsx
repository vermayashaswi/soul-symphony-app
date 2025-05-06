
import React from 'react';
import { useLocation } from 'react-router-dom';
import { isAppRoute } from '@/routes/RouteHelpers';

// This is a non-visible component that adds tutorial target elements
// to pages where we need them but don't have a visible UI element to target

const WelcomeElement: React.FC = () => {
  const location = useLocation();
  const isAppPath = isAppRoute(location.pathname);
  
  // Only render on app routes to avoid unnecessary DOM elements
  if (!isAppPath) {
    return null;
  }
  
  console.log('Rendering WelcomeElement on path:', location.pathname);
  
  return (
    <div className="hidden">
      <div id="tutorial-welcome" data-tutorial="tutorial-welcome"></div>
      <div id="tutorial-complete" data-tutorial="tutorial-complete"></div>
    </div>
  );
};

export default WelcomeElement;
