
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsContext';
import { ContextReadinessProvider } from '@/contexts/ContextReadinessContext';
import { TutorialProvider } from '@/contexts/TutorialContext';
import { TranslationProvider } from '@/contexts/TranslationContext';

import AppRoutes from '@/components/AppRoutes';
import OfflineIndicator from '@/components/OfflineIndicator';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import '@/app/globals.css';
import CapacitorInit from '@/app/capacitor-init';

// Create a query client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <CapacitorInit>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
          <TranslationProvider>
            <BrowserRouter>
              <AuthProvider>
                <SubscriptionProvider>
                  <LocationProvider>
                    <FeatureFlagsProvider>
                      <ContextReadinessProvider>
                        <TutorialProvider>
                          <div className="min-h-screen bg-background font-sans antialiased">
                            <Toaster />
                            <OfflineIndicator />
                            <PWAInstallPrompt />
                            <NotificationCenter />
                            <AppRoutes />
                          </div>
                        </TutorialProvider>
                      </ContextReadinessProvider>
                    </FeatureFlagsProvider>
                  </LocationProvider>
                </SubscriptionProvider>
              </AuthProvider>
            </BrowserRouter>
          </TranslationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </CapacitorInit>
  );
}

export default App;
