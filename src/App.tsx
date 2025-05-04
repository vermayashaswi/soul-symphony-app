
import React, { useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { JournalProcessingInitializer } from './app/journal-processing-init';
import { ThemeProvider } from '@/hooks/use-theme';
import { AuthProvider } from '@/contexts/AuthContext';
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
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <JournalProcessingInitializer />
        <AppRoutes />
        <Toaster />
        <SonnerToaster position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
