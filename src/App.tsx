
import React, { useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TranslationProvider } from '@/contexts/TranslationContext';
import { TranslationLoadingOverlay } from '@/components/translation/TranslationLoadingOverlay';
import { JournalProcessingInitializer } from './app/journal-processing-init';
import './styles/emoji.css';

const App: React.FC = () => {
  useEffect(() => {
    console.log('App mounted, current path:', window.location.pathname);
    
    // Clean up any malformed paths
    const currentPath = window.location.pathname;
    
    // Fix incorrectly formatted URLs that have domains or https in the path
    if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
      console.log('Fixing malformed URL path:', currentPath);
      window.history.replaceState(null, '', '/');
    }
    
    // CRITICAL FIX: If the user is at the root path (/) and trying to use Insights
    // redirect them to the proper /app/insights path
    if (currentPath === '/' && 
        (document.title.includes('Insights') || 
         window.location.href.includes('insights') ||
         document.querySelector('.insights-container'))) {
      console.log('Detected Insights at root path, redirecting to /app/insights');
      window.history.replaceState(null, '', '/app/insights');
      // Force reload page if needed
      setTimeout(() => {
        if (window.location.pathname === '/') {
          console.log('Force navigating to /app/insights');
          window.location.href = '/app/insights';
        }
      }, 50);
    }
  }, []);
  
  // Add a second useEffect for post-render detection
  useEffect(() => {
    // After DOM has updated, look for insights components
    const observer = new MutationObserver((mutations) => {
      if (window.location.pathname === '/' && 
          (document.querySelector('.insights-container') || 
           document.querySelector('.soul-net-visualization'))) {
        console.log('Detected Insights container at root path, redirecting');
        window.history.replaceState(null, '', '/app/insights');
        window.dispatchEvent(new Event('popstate'));
      }
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    return () => observer.disconnect();
  }, []);

  return (
    <TranslationProvider>
      <TranslationLoadingOverlay />
      <JournalProcessingInitializer />
      <AppRoutes />
      <Toaster />
      <SonnerToaster position="top-right" />
    </TranslationProvider>
  );
};

export default App;
