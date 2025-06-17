
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
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
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <NetworkAwareContent>
            <AuthProvider>
              <TranslationProvider>
                <LocationProvider>
                  <SubscriptionProvider>
                    <FeatureFlagsProvider>
                      <TutorialProvider>
                        <AppRoutes />
                        <InstallPrompt />
                        <Toaster />
                      </TutorialProvider>
                    </FeatureFlagsProvider>
                  </SubscriptionProvider>
                </LocationProvider>
              </TranslationProvider>
            </AuthProvider>
          </NetworkAwareContent>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
