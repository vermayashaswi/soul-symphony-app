
import React, { useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';
import { JournalProcessingInitializer } from './app/journal-processing-init';
import { ThemeProvider } from '@/hooks/use-theme';
import ErrorBoundary from './components/insights/ErrorBoundary';

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

    // Additional debugging
    console.log('App initialization complete, ready to render routes');
  }, []);

  return (
    <ErrorBoundary fallback={<div className="p-4">Something went wrong loading the application.</div>}>
      <ThemeProvider>
        <JournalProcessingInitializer />
        <AppRoutes />
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
