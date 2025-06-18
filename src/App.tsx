import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ClerkProvider, useUser } from '@clerk/clerk-react';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsContext';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { TutorialProvider } from '@/contexts/TutorialContext';
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toaster"
import Home from '@/pages/Home';
import Journal from '@/pages/Journal';
import Insights from '@/pages/Insights';
import SmartChat from '@/pages/SmartChat';
import Settings from '@/pages/Settings';
import Legal from '@/pages/Legal';
import PrivacyPolicyPage from '@/pages/legal/PrivacyPolicyPage';
import TermsOfServicePage from '@/pages/legal/TermsOfServicePage';
import Offline from '@/pages/Offline';
import NotFound from '@/pages/NotFound';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AppUpdateManager } from '@/components/app/AppUpdateManager';
import { PWAStatusIndicator } from '@/components/app/PWAStatusIndicator';
import { featureFlagService } from '@/services/featureFlagService';
import { PWADebugPanel } from '@/components/debug/PWADebugPanel';

const queryClient = new QueryClient();

// Retrieve Clerk publishable key from environment - be sure to add this to your .env file.
const clerkPubKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error("Missing Publishable Key")
}

function App() {
  const { isLoaded } = useUser();

  // Initialize services on app start
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize service worker
        if ('serviceWorker' in navigator) {
          const { initializeServiceWorker } = await import('@/utils/serviceWorker');
          await initializeServiceWorker();
        }

        console.log('[App] Services initialized');
      } catch (error) {
        console.error('[App] Service initialization failed:', error);
      }
    };

    initializeApp();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      featureFlagService.destroy();
    };
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ClerkProvider publishableKey={clerkPubKey}>
        <AuthProvider>
          <SubscriptionProvider>
            <FeatureFlagsProvider>
              <TranslationProvider>
                <TutorialProvider>
                  <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                    <TooltipProvider>
                      <div className="min-h-screen bg-background font-sans antialiased">
                        {/* App Update Manager */}
                        <AppUpdateManager />
                        
                        {/* PWA Status Indicator */}
                        <PWAStatusIndicator className="fixed top-2 right-2 z-40" />
                        
                        {/* PWA Debug Panel (development only) */}
                        <PWADebugPanel />
                        
                        {/* Main App Content */}
                        <Toaster />
                        <Suspense fallback={<div>Loading...</div>}>
                          <Router>
                            <Routes>
                              <Route path="/" element={<Legal />} />
                              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                              <Route path="/terms-of-service" element={<TermsOfServicePage />} />
                              <Route path="/app" element={<Home />} />
                              <Route path="/app/home" element={<Home />} />
                              <Route path="/app/journal" element={<Journal />} />
                              <Route path="/app/insights" element={<Insights />} />
                              <Route path="/app/smart-chat" element={<SmartChat />} />
                              <Route path="/app/settings" element={<Settings />} />
                              <Route path="/offline" element={<Offline />} />
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </Router>
                        </Suspense>
                      </div>
                    </TooltipProvider>
                  </ThemeProvider>
                </TutorialProvider>
              </TranslationProvider>
            </FeatureFlagsProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </ClerkProvider>
    </QueryClientProvider>
  );
}

export default App;
