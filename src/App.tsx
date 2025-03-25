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
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import ParticleBackground from "./components/ParticleBackground";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "./integrations/supabase/client";
import Navbar from "./components/Navbar";
import { refreshAuthSession } from "./utils/audio/auth-utils";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Protected route component with location preservation
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, refreshSession } = useAuth();
  const location = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  useEffect(() => {
    if (!isLoading && !user && !isRefreshing) {
      console.log("Protected route: No user found, attempting to refresh session", {
        path: location.pathname
      });
      
      setIsRefreshing(true);
      
      // Try refreshing the session if we don't have a user
      refreshSession().then(() => {
        console.log("Session refresh attempt completed");
        setIsRefreshing(false);
      }).catch(() => {
        setIsRefreshing(false);
      });
    }
  }, [user, isLoading, location, refreshSession, isRefreshing]);
  
  // Show loading spinner while authentication is being checked
  if (isLoading || isRefreshing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Redirect to auth page if user is not authenticated
  if (!user) {
    console.log("Redirecting to auth from protected route:", location.pathname);
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

// Layout component to wrap all routes with common elements like Navbar
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isAuthPage = location.pathname === "/auth";
  
  return (
    <>
      {/* Don't show navbar on auth page */}
      {!isAuthPage && <Navbar />}
      <div className={!isAuthPage ? "pt-16" : ""}>
        {children}
      </div>
    </>
  );
};

const AppRoutes = () => {
  // Ensure supabase client is properly configured and refreshing tokens
  useEffect(() => {
    console.log("Setting up Supabase auth debugging listener");
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event outside React context:", event, session?.user?.email);
      
      // Extra debug for auth issues
      if (session) {
        console.log("User authentication details:", {
          id: session.user?.id,
          email: session.user?.email,
          hasAccessToken: !!session.access_token,
          hasRefreshToken: !!session.refresh_token,
          expiresAt: session.expires_at
        });
      }
    });
    
    // Check the session on mount for debugging
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Initial session check error:", error);
      } else if (data.session) {
        console.log("Initial session present:", {
          userId: data.session.user.id,
          email: data.session.user.email
        });
      } else {
        console.log("No initial session found");
        
        // Try to refresh auth session when app loads if no session is found
        refreshAuthSession().then(success => {
          console.log("Auto-refresh session result:", success ? "Success" : "Failed");
        });
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  return (
    <AppLayout>
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
        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner position="top-center" />
        <ParticleBackground />
        <BrowserRouter>
          <AnimatePresence mode="wait">
            <AppRoutes />
          </AnimatePresence>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
