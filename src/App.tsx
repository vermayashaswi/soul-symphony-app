
import React from 'react';
import AppRoutes from './routes/AppRoutes';
import { ThemeProvider } from './hooks/use-theme';
import { Toaster } from 'sonner';
import './App.css';
import './styles/mobile.css';

import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { TutorialProvider } from '@/contexts/TutorialContext';

function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <TranslationProvider>
          <TutorialProvider>
            <ThemeProvider>
              <div className="min-h-screen bg-background font-sans antialiased">
                <Toaster />
                <AppRoutes />
              </div>
            </ThemeProvider>
          </TutorialProvider>
        </TranslationProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

export default App;
