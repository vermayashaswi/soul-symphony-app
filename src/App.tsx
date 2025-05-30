
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { TutorialProvider } from '@/contexts/TutorialContext';
import { useSessionTracking } from '@/hooks/useSessionTracking';
import { debugLogger } from '@/components/debug/DebugPanel';
import AppRoutes from '@/routes/AppRoutes';
import './i18n/i18n';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Component to initialize session tracking
function SessionTracker() {
  useSessionTracking();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <TooltipProvider>
          <TranslationProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <TutorialProvider>
                  <SessionTracker />
                  <AppRoutes />
                  <Toaster />
                  <ReactQueryDevtools initialIsOpen={false} />
                </TutorialProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </TranslationProvider>
        </TooltipProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
