
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ViewportManager: React.FC = () => {
  const location = useLocation();
  
  useEffect(() => {
    console.log("Setting up viewport for iOS compatibility");
    
    const setCorrectViewport = () => {
      const metaViewport = document.querySelector('meta[name="viewport"]');
      // iOS-specific viewport settings with safe area insets
      const correctContent = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      
      if (metaViewport) {
        if (metaViewport.getAttribute('content') !== correctContent) {
          console.log("Updating existing viewport meta tag for iOS compatibility");
          metaViewport.setAttribute('content', correctContent);
        }
      } else {
        console.log("Creating new iOS-compatible viewport meta tag");
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = correctContent;
        document.head.appendChild(meta);
      }
      
      // Add iOS status bar meta tags
      if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
        const appleMobileWebAppCapable = document.createElement('meta');
        appleMobileWebAppCapable.name = 'apple-mobile-web-app-capable';
        appleMobileWebAppCapable.content = 'yes';
        document.head.appendChild(appleMobileWebAppCapable);
      }
      
      if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
        const statusBarStyle = document.createElement('meta');
        statusBarStyle.name = 'apple-mobile-web-app-status-bar-style';
        statusBarStyle.content = 'black-translucent';
        document.head.appendChild(statusBarStyle);
      }
    };
    
    setCorrectViewport();
    // Set again after a delay to handle any race conditions
    setTimeout(setCorrectViewport, 100);
  }, [location.pathname]);
  
  return null;
};

export default ViewportManager;
