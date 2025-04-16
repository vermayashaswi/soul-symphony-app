
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
      
      // iOS touch optimization meta tag
      if (!document.querySelector('meta[name="mobile-web-app-capable"]')) {
        const mobileCapable = document.createElement('meta');
        mobileCapable.name = 'mobile-web-app-capable';
        mobileCapable.content = 'yes';
        document.head.appendChild(mobileCapable);
      }
      
      // Handle full screen properly on notched iPhones
      if (!document.querySelector('meta[name="apple-touch-fullscreen"]')) {
        const fullscreen = document.createElement('meta');
        fullscreen.name = 'apple-touch-fullscreen';
        fullscreen.content = 'yes';
        document.head.appendChild(fullscreen);
      }
      
      // Add meta tag to prevent iOS zoom
      if (!document.querySelector('meta[name="HandheldFriendly"]')) {
        const handHeld = document.createElement('meta');
        handHeld.name = 'HandheldFriendly';
        handHeld.content = 'true';
        document.head.appendChild(handHeld);
      }
      
      // Set page-specific event persistence (helps for iOS state persistence)
      if (location.pathname.includes('journal')) {
        document.documentElement.classList.add('journal-page');
        
        // Check if we need to restore processing state
        const processingEntries = sessionStorage.getItem('processingEntries');
        if (processingEntries && JSON.parse(processingEntries).length > 0) {
          console.log('Found processing entries on page load, will restore state');
          
          // Dispatch event after a small delay to ensure components are mounted
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
              detail: { 
                entries: JSON.parse(processingEntries), 
                lastUpdate: Date.now(),
                forceUpdate: true,
                restoredFromNavigation: true
              }
            }));
          }, 500);
        }
      } else {
        document.documentElement.classList.remove('journal-page');
      }
    };
    
    setCorrectViewport();
    // Set again after a delay to handle any race conditions or iOS orientation changes
    setTimeout(setCorrectViewport, 100);
    setTimeout(setCorrectViewport, 500); // Another attempt for stubborn iOS devices
    
    // Also handle orientation changes
    const handleOrientationChange = () => {
      setTimeout(setCorrectViewport, 100);
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Also handle page visibility changes (app being backgrounded/foregrounded)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('App returned to foreground, checking for state restoration');
        setTimeout(setCorrectViewport, 100);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location.pathname]);
  
  return null;
};

export default ViewportManager;
