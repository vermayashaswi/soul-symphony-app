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
import { MobileBrowserDebug } from "./components/MobileBrowserDebug";
import SmartChatMobileDebug from "./components/chat/SmartChatMobileDebug";
import DebugPanel from "./components/DebugPanel";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const MobileRouteWrapper = ({ children }: { children: React.ReactNode }) => {
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  return mobileDemo ? <MobilePreviewFrame>{children}</MobilePreviewFrame> : <>{children}</>;
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
    const url = new URL(`/auth`, window.location.origin);
    url.searchParams.set('redirectTo', location.pathname);
    
    console.log("Redirecting to auth from protected route:", location.pathname);
    return <Navigate to={url.pathname + url.search} replace />;
  }
  
  return <>{children}</>;
};

// Separated DebugTools component that will be rendered inside AuthProvider
const DebugTools = () => {
  const isMobile = useIsMobile();
  
  return (
    <>
      {isMobile ? (
        <SmartChatMobileDebug />
      ) : (
        <DebugPanel />
      )}
      <MobileBrowserDebug />
    </>
  );
};

const AppRoutes = () => {
  const isMobile = useIsMobile();
  const shouldShowMobileNav = isMobile;

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
          <MobileRouteWrapper>
            <Index />
          </MobileRouteWrapper>
        } />
        <Route path="/auth" element={
          <MobileRouteWrapper>
            <Auth />
          </MobileRouteWrapper>
        } />
        <Route path="/journal" element={
          <MobileRouteWrapper>
            <ProtectedRoute>
              <Journal />
            </ProtectedRoute>
          </MobileRouteWrapper>
        } />
        <Route path="/insights" element={
          <MobileRouteWrapper>
            <ProtectedRoute>
              <Insights />
            </ProtectedRoute>
          </MobileRouteWrapper>
        } />
        <Route path="/chat" element={
          <Navigate to="/smart-chat" replace />
        } />
        <Route path="/smart-chat" element={
          <MobileRouteWrapper>
            <ProtectedRoute>
              <SmartChat />
            </ProtectedRoute>
          </MobileRouteWrapper>
        } />
        <Route path="/settings" element={
          <MobileRouteWrapper>
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          </MobileRouteWrapper>
        } />
        <Route path="*" element={
          <MobileRouteWrapper>
            <NotFound />
          </MobileRouteWrapper>
        } />
      </Routes>

      {shouldShowMobileNav && <MobileNavbar />}
    </>
  );
};

function App() {
  return (
    <div className="app-container">
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
              {/* Debug tools now inside AuthProvider */}
              <DebugTools />
            </ThemeProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
