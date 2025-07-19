
import { Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/hooks/use-theme';
import { SafeAreaProvider } from '@/components/layout/SafeAreaProvider';
import AppRoutes from '@/routes/AppRoutes';

const queryClient = new QueryClient();

function App() {
  console.log('[App] App component rendering');
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <SafeAreaProvider>
              <AppRoutes />
              <Toaster />
            </SafeAreaProvider>
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
