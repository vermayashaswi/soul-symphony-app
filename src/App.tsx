
import { Suspense } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/hooks/use-theme';
import { SafeAreaProvider } from '@/components/layout/SafeAreaProvider';
import { SafeToaster } from '@/components/layout/SafeToaster';
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
            </SafeAreaProvider>
            {/* Move Toaster inside Suspense but ensure it's after other content */}
            <SafeToaster />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
