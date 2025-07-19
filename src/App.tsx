import { Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from '@/components/layout/SafeAreaProvider';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Suspense fallback={<div>Loading...</div>}>
          <SafeAreaProvider>
            <div className="min-h-screen bg-background">
              <div>App is ready - Routes need to be configured</div>
            </div>
            <Toaster />
          </SafeAreaProvider>
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;