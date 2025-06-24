import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsContext';
import { ContextReadinessManager } from '@/contexts/ContextReadinessContext';
import { TutorialProvider } from '@/contexts/TutorialContext';
import { TranslationProvider } from '@/contexts/TranslationContext';

import AppRoutes from '@/components/AppRoutes';
import OfflineIndicator from '@/components/OfflineIndicator';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import '@/app/globals.css';
import CapacitorInit from '@/app/capacitor-init';

function App() {
  return (
    <CapacitorInit>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
          <TranslationProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <LocationProvider>
                  <FeatureFlagsProvider>
                    <ContextReadinessManager>
                      <TutorialProvider>
                        <BrowserRouter>
                          <div className="min-h-screen bg-background font-sans antialiased">
                            <Toaster />
                            <OfflineIndicator />
                            <PWAInstallPrompt />
                            <NotificationCenter />
                            <AppRoutes />
                          </div>
                        </BrowserRouter>
                      </TutorialProvider>
                    </ContextReadinessManager>
                  </FeatureFlagsProvider>
                </LocationProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </TranslationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </CapacitorInit>
  );
}

export default App;
