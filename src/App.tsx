import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from 'sonner';
import './App.css';
import './styles/mobile.css';
import { SouloLogo } from '@/components/icons';

import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { TutorialProvider } from '@/contexts/TutorialContext';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SubscriptionProvider>
          <TranslationProvider>
            <TutorialProvider>
              <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
                <div className="min-h-screen bg-background font-sans antialiased">
                  <Toaster />
                  <AppRoutes />
                </div>
              </ThemeProvider>
            </TutorialProvider>
          </TranslationProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
