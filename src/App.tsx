
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
import { useEffect, useState } from "react";
import { supabase } from "./integrations/supabase/client";
import MobilePreviewFrame from "./components/MobilePreviewFrame";
import MobileDebugOverlay from "./components/MobileDebugOverlay";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
    console.log("Redirecting to auth from protected route:", location.pathname);
    return <Navigate to={`/auth?redirectTo=${location.pathname}`} replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  const [renderError, setRenderError] = useState(false);
  const location = useLocation();
  
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

    // Force visibility for mobile elements
    const forceVisibility = () => {
      const containers = document.querySelectorAll('.smart-chat-container, .smart-chat-interface, .container');
      containers.forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.display = el.classList.contains('flex') ? 'flex' : 'block';
          el.style.visibility = 'visible';
          el.style.opacity = '1';
        }
      });
    };

    // Apply visibility fix after render and with delay
    forceVisibility();
    const timer = setTimeout(forceVisibility, 500);
    
    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [location]);

  // Error boundary effect
  useEffect(() => {
    // Check if the main content rendered correctly
    const checkRender = () => {
      if (location.pathname === '/smart-chat') {
        const smartChatElement = document.querySelector('.smart-chat-interface');
        if (!smartChatElement && !renderError) {
          console.error('Smart chat interface failed to render');
          setRenderError(true);
        }
      }
    };
    
    // Check after a reasonable delay
    const timer = setTimeout(checkRender, 2000);
    return () => clearTimeout(timer);
  }, [location, renderError]);
  
  // Show a very simple emergency fallback if needed
  if (renderError && location.pathname === '/smart-chat') {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh'
      }}>
        <h2>Smart Chat</h2>
        <p>The chat interface couldn't be loaded properly.</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            background: '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            marginTop: '16px'
          }}
        >
          Reload Page
        </button>
      </div>
    );
  }
  
  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/journal" element={
          <ProtectedRoute>
            <Journal />
          </ProtectedRoute>
        } />
        <Route path="/insights" element={
          <ProtectedRoute>
            <Insights />
          </ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        } />
        <Route path="/smart-chat" element={
          <ProtectedRoute>
            <SmartChat />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <MobileDebugOverlay />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ThemeProvider>
          <div className="relative min-h-screen">
            <div className="relative z-10">
              <Toaster />
              <Sonner position="top-center" />
              <BrowserRouter>
                <MobilePreviewFrame>
                  <AnimatePresence mode="wait">
                    <AppRoutes />
                  </AnimatePresence>
                </MobilePreviewFrame>
              </BrowserRouter>
            </div>
          </div>
        </ThemeProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
