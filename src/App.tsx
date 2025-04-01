
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Index from "./pages/Index";
import Journal from "./pages/Journal";
import Insights from "./pages/Insights";
import Chat from "./pages/Chat";
import SmartChat from "./pages/SmartChat";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./hooks/use-theme";
import { useEffect } from "react";
import { supabase } from "./integrations/supabase/client";
import "./styles/mobile.css";
import MobilePreviewFrame from "./components/MobilePreviewFrame";
import MobileNavbar from "./components/mobile/MobileNavbar";
import { useIsMobile } from "./hooks/use-mobile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const MobilePreviewWrapper = ({ children }: { children: React.ReactNode }) => {
  // In our mobile-only app, always use the mobile frame
  return <MobilePreviewFrame>{children}</MobilePreviewFrame>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  
  useEffect(() => {
    if (!isLoading && !user) {
      console.log("Protected route: No user, should redirect to /auth", {
        path: location.pathname
      });
    }
  }, [user, isLoading, location]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    // Ensure mobile parameter is preserved in the redirect URL
    const url = new URL(`/auth`, window.location.origin);
    url.searchParams.set('redirectTo', location.pathname);
    url.searchParams.set('mobileDemo', 'true');
    
    console.log("Redirecting to auth from protected route:", location.pathname);
    return <Navigate to={url.pathname + url.search} replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  const isMobile = useIsMobile();
  // Always enable mobile mode
  const shouldShowMobileNav = true;

  useEffect(() => {
    const setCorrectViewport = () => {
      const metaViewport = document.querySelector('meta[name="viewport"]');
      const correctContent = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      
      if (metaViewport) {
        if (metaViewport.getAttribute('content') !== correctContent) {
          console.log("Updating existing viewport meta tag");
          metaViewport.setAttribute('content', correctContent);
        }
      } else {
        console.log("Creating new viewport meta tag");
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = correctContent;
        document.head.appendChild(meta);
      }
    };
    
    setCorrectViewport();
    setTimeout(setCorrectViewport, 100);
    
    // Set initial URL parameters for mobile if not already present
    if (!window.location.search.includes('mobileDemo=true')) {
      const url = new URL(window.location.href);
      url.searchParams.set('mobileDemo', 'true');
      window.history.replaceState({}, document.title, url.toString());
    }
    
    console.log("Setting up Supabase auth debugging listener");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event outside React context:", event, session?.user?.email);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  return (
    <>
      <Routes>
        <Route path="/" element={
          <MobilePreviewWrapper>
            <Index />
          </MobilePreviewWrapper>
        } />
        <Route path="/auth" element={
          <MobilePreviewWrapper>
            <Auth />
          </MobilePreviewWrapper>
        } />
        <Route path="/journal" element={
          <MobilePreviewWrapper>
            <ProtectedRoute>
              <Journal />
            </ProtectedRoute>
          </MobilePreviewWrapper>
        } />
        <Route path="/insights" element={
          <MobilePreviewWrapper>
            <ProtectedRoute>
              <Insights />
            </ProtectedRoute>
          </MobilePreviewWrapper>
        } />
        <Route path="/chat" element={
          <Navigate to="/smart-chat?mobileDemo=true" replace />
        } />
        <Route path="/smart-chat" element={
          <MobilePreviewWrapper>
            <ProtectedRoute>
              <SmartChat />
            </ProtectedRoute>
          </MobilePreviewWrapper>
        } />
        <Route path="/settings" element={
          <MobilePreviewWrapper>
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          </MobilePreviewWrapper>
        } />
        <Route path="*" element={
          <MobilePreviewWrapper>
            <NotFound />
          </MobilePreviewWrapper>
        } />
      </Routes>

      {shouldShowMobileNav && <MobileNavbar />}
    </>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <ThemeProvider>
            <div className="relative min-h-screen">
              <div className="relative z-10">
                <Toaster />
                <Sonner position="top-center" />
                <BrowserRouter>
                  <AnimatePresence mode="wait">
                    <AppRoutes />
                  </AnimatePresence>
                </BrowserRouter>
              </div>
            </div>
          </ThemeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
