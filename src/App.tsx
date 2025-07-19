import { Suspense, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/contexts/AuthContext';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { SafeAreaProvider } from '@/components/layout/SafeAreaProvider';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <AuthProvider>
              <TranslationProvider>
                <SafeAreaProvider>
                  <div className="min-h-screen bg-background">
                    <div>App is ready - Routes need to be configured</div>
                  </div>
                  <Toaster />
                </SafeAreaProvider>
              </TranslationProvider>
            </AuthProvider>
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
