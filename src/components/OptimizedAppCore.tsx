import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { OptimizedAuthProvider } from '@/contexts/OptimizedAuthContext';
import { OptimizedSubscriptionProvider } from '@/contexts/OptimizedSubscriptionContext';
import { TutorialProvider } from '@/contexts/TutorialContext';
import OptimizedAppRoutes from '@/routes/OptimizedAppRoutes';
import { nativeAppInitService } from '@/services/nativeAppInitService';
import { optimizedRouteService } from '@/services/optimizedRouteService';
import { deferredInitService } from '@/services/deferredInitService';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export function OptimizedAppCore() {
  const [isNativeReady, setIsNativeReady] = useState(false);
  const isNative = optimizedRouteService.isNativeApp();

  useEffect(() => {
    const initializeApp = async () => {
      if (isNative) {
        console.log('[OptimizedApp] Initializing native app...');
        
        // Don't block on native initialization
        nativeAppInitService.initialize().then((success) => {
          console.log('[OptimizedApp] Native initialization completed:', success);
          setIsNativeReady(true);
        }).catch((error) => {
          console.warn('[OptimizedApp] Native initialization failed:', error);
          setIsNativeReady(true); // Continue anyway
        });
        
        // Allow immediate rendering for native apps
        setTimeout(() => setIsNativeReady(true), 100);
      } else {
        setIsNativeReady(true);
      }
    };

    initializeApp();

    // Initialize deferred services after app is ready
    deferredInitService.initialize();
  }, [isNative]);

  // For native apps, show minimal loading if not ready yet
  if (isNative && !isNativeReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <BrowserRouter>
          <OptimizedAuthProvider>
            <OptimizedSubscriptionProvider>
              <TutorialProvider>
                <OptimizedAppRoutes />
                <Toaster 
                  position="top-center"
                  expand={false}
                  richColors
                  closeButton
                />
              </TutorialProvider>
            </OptimizedSubscriptionProvider>
          </OptimizedAuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}