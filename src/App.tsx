
import { useEffect } from 'react';
import AppRoutes from './AppRoutes';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { UIProvider } from '@/contexts/UIContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { useMediaQuery } from '@/hooks/use-media-query';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { MobileProvider } from '@/contexts/MobileContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { debugAudioProcessing } from '@/utils/debug/audio-debug';
import { debugLog } from './utils/debug/debugLog';

function App() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  useEffect(() => {
    // Initialize debug utilities
    debugAudioProcessing();
    debugLog('App initialized');
    
    // Log detection info
    debugLog('Mobile detection:', {
      isMobile,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });
  }, []);

  return (
    <ThemeProvider defaultTheme="light">
      <MobileProvider>
        <UIProvider>
          <ToastProvider>
            <AuthProvider>
              <SidebarProvider>
                <OnboardingProvider>
                  <AppRoutes />
                  <Toaster />
                </OnboardingProvider>
              </SidebarProvider>
            </AuthProvider>
          </ToastProvider>
        </UIProvider>
      </MobileProvider>
    </ThemeProvider>
  );
}

export default App;
