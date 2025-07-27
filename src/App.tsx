import React, { useEffect } from 'react';
import { OptimizedAppCore } from '@/components/OptimizedAppCore';
import ErrorBoundary from './components/insights/ErrorBoundary';
import { preloadCriticalImages } from './utils/imagePreloader';
import './styles/emoji.css';
import './styles/tutorial.css';

const App: React.FC = () => {
  useEffect(() => {
    // Preload critical images
    try {
      console.log('[App] Preloading critical images...');
      preloadCriticalImages();
    } catch (error) {
      console.warn('Failed to preload some images:', error);
    }

    // Clean up any malformed paths
    const currentPath = window.location.pathname;
    if (currentPath.includes('https://') || currentPath.includes('soulo.online')) {
      window.history.replaceState(null, '', '/');
    }

    // Apply CSS class for theme overrides
    document.body.classList.add('app-initialized');
  }, []);

  const handleAppError = (error: Error, errorInfo: any) => {
    console.error('Application-level error:', error, errorInfo);
    
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.error('Detailed error info:', errorData);
  };

  return (
    <ErrorBoundary onError={handleAppError}>
      <OptimizedAppCore />
    </ErrorBoundary>
  );
};

export default App;