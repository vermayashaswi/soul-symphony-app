import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * A hook that scrolls to the top of the page when route changes
 * and handles hash navigation for anchor links
 */
export const useScrollRestoration = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // If there's a hash, scroll to the element with that id
    if (hash) {
      // Short delay to ensure DOM has updated
      setTimeout(() => {
        const element = document.getElementById(hash.substring(1));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      // Otherwise scroll to top on route change
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [pathname, hash]);
};
