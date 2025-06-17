
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import ViewportManager from "@/routes/ViewportManager";
import AppRoutes from "@/routes/AppRoutes";
import { NetworkAwareContent } from "@/components/NetworkAwareContent";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TooltipProvider>
            <NetworkAwareContent>
              <AuthProvider>
                <TranslationProvider>
                  <SubscriptionProvider>
                    <FeatureFlagsProvider>
                      <TutorialProvider>
                        <ViewportManager>
                          <AppRoutes />
                          <InstallPrompt />
                          <Toaster />
                        </ViewportManager>
                      </TutorialProvider>
                    </FeatureFlagsProvider>
                  </SubscriptionProvider>
                </TranslationProvider>
              </AuthProvider>
            </NetworkAwareContent>
          </TooltipProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
