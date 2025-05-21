
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * A hook that scrolls to the top of the page when route changes
 * and handles hash navigation for anchor links
 */
export const useScrollRestoration = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Log for debugging
    console.log('ScrollRestoration: Path changed to', pathname, hash ? `with hash: ${hash}` : 'without hash');
    
    // Skip scroll restoration on the home page which needs to stay fixed
    if (pathname === '/app/home' || pathname === '/app') {
      console.log('ScrollRestoration: Home page detected, keeping scroll disabled');
      return;
    }
    
    // Check if body has tutorial classes that might prevent scrolling
    const hasTutorialClass = document.body.classList.contains('tutorial-active');
    if (hasTutorialClass) {
      console.log('ScrollRestoration: Tutorial active, not changing scroll');
      return;
    }
    
    // Always ensure body can scroll on route changes (except home)
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.top = '';
    document.body.style.left = '';
    
    // If there's a hash, scroll to the element with that id
    if (hash) {
      // Short delay to ensure DOM has updated
      setTimeout(() => {
        const element = document.getElementById(hash.substring(1));
        if (element) {
          console.log('ScrollRestoration: Scrolling to hash element', hash);
          element.scrollIntoView({ behavior: 'smooth' });
        } else {
          console.log('ScrollRestoration: Hash element not found', hash);
        }
      }, 100);
    } else {
      // Otherwise scroll to top on route change
      console.log('ScrollRestoration: Scrolling to top');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [pathname, hash]);
};

/**
 * Utility function to scroll to the top of the page
 */
export const scrollToTop = () => {
  const { pathname } = window.location;
  
  // Skip for home page
  if (pathname === '/app/home' || pathname === '/app') {
    return;
  }
  
  // Ensure body can scroll (except on home)
  document.body.style.overflow = '';
  document.body.style.position = '';
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  console.log('ScrollRestoration: Manual scroll to top triggered');
};

/**
 * Force enable scrolling by removing any style properties that might prevent it
 * But not on home page where scrolling should be disabled
 */
export const forceEnableScrolling = () => {
  const { pathname } = window.location;
  
  // Skip for home page
  if (pathname === '/app/home' || pathname === '/app') {
    return;
  }
  
  document.body.classList.remove('tutorial-active');
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.touchAction = '';
  document.body.style.width = '';
  document.body.style.height = '';
  document.body.style.top = '';
  document.body.style.left = '';
  console.log('ScrollRestoration: Forced scroll enabling');
};
