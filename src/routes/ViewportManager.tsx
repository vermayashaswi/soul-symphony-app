
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ViewportManager: React.FC = () => {
  const location = useLocation();
  
  useEffect(() => {
    console.log("Setting up viewport for iOS compatibility");
    
    const setCorrectViewport = () => {
      const metaViewport = document.querySelector('meta[name="viewport"]');
      // Standard viewport settings
      const correctContent = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      
      if (metaViewport) {
        if (metaViewport.getAttribute('content') !== correctContent) {
          console.log("Updating existing viewport meta tag");
          metaViewport.setAttribute('content', correctContent);
        }
      } else {
        console.log("Creating new viewport meta tag");
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = correctContent;
        document.head.appendChild(meta);
      }
      
      // Add iOS status bar meta tag if needed
      if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
        const appleMobileWebAppCapable = document.createElement('meta');
        appleMobileWebAppCapable.name = 'apple-mobile-web-app-capable';
        appleMobileWebAppCapable.content = 'yes';
        document.head.appendChild(appleMobileWebAppCapable);
      }
    };
    
    setCorrectViewport();
    
    // Setup again after a short delay to handle race conditions
    setTimeout(setCorrectViewport, 100);
    
    // Handle orientation changes
    const handleOrientationChange = () => {
      setTimeout(setCorrectViewport, 100);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [location.pathname]);
  
  return null;
};

export default ViewportManager;
