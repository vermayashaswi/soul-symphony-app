import { useToast, toast } from "@/hooks/use-toast";

// Create a wrapper for the website pages that disables toasts
const isWebsitePage = () => {
  // Check if we're in the browser
  if (typeof window === 'undefined') return false;
  
  // Get the current pathname
  const pathname = window.location.pathname;
  
  // Define website pages (as opposed to app pages)
  const websitePatterns = [
    /^\/$/, // Root/home
    /^\/website/,
    /^\/blog/,
    /^\/faq/,
    /^\/privacy-policy/,
    /^\/terms/
  ];
  
  // Check if current path matches any website patterns
  return websitePatterns.some(pattern => pattern.test(pathname));
};

// Create a modified version of toast that does nothing on website pages
const websiteSafeToast: typeof toast = (...args) => {
  if (isWebsitePage()) {
    // Return a dummy object with the same interface
    return {
      id: 'dummy-id',
      dismiss: () => {},
      update: () => {},
    };
  }
  
  // Otherwise, use the normal toast
  return toast(...args);
};

export { useToast, websiteSafeToast as toast };
