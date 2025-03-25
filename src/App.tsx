import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Index from "./pages/Index";
import Journal from "./pages/Journal";
import Record from "./pages/Record";
import Insights from "./pages/Insights";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import ParticleBackground from "./components/ParticleBackground";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "./integrations/supabase/client";
import Navbar from "./components/Navbar";
import { refreshAuthSession } from "./utils/audio/auth-utils";

const App = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
    },
  });

  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Sonner position="top-center" closeButton />
            <ParticleBackground />
            <BrowserRouter>
              <AnimatePresence mode="wait">
                <AppRoutes />
              </AnimatePresence>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  
  useEffect(() => {
    if (!isLoading && !user && !refreshAttempted) {
      console.log("Protected route: No user found, attempting to refresh session", {
        path: location.pathname
      });
      
      refreshAuthSession(false).then(success => {
        console.log("Session refresh attempt completed:", success ? "Success" : "Failed");
        setRefreshAttempted(true);
      }).catch(() => {
        setRefreshAttempted(true);
      });
    }
  }, [user, isLoading, location, refreshAttempted]);
  
  if (isLoading && !refreshAttempted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (user) {
    return <>{children}</>;
  }
  
  if (refreshAttempted || !isLoading) {
    console.log("Redirecting to auth from protected route:", location.pathname);
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isAuthPage = location.pathname === "/auth";
  
  return (
    <>
      {!isAuthPage && <Navbar />}
      <div className={!isAuthPage ? "pt-16" : ""}>
        {children}
      </div>
    </>
  );
};

const AppRoutes = () => {
  useEffect(() => {
    console.log("Setting up Supabase auth debugging listener");
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event outside React context:", event, session?.user?.email);
      
      if (session) {
        console.log("User authentication details:", {
          id: session.user?.id,
          email: session.user?.email,
          hasAccessToken: !!session.access_token,
          hasRefreshToken: !!session.refresh_token,
          expiresAt: new Date(session.expires_at! * 1000).toISOString()
        });
      }
    });
    
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Initial session check error:", error);
      } else if (data.session) {
        console.log("Initial session present:", {
          userId: data.session.user.id,
          email: data.session.user.email,
          expiresAt: new Date(data.session.expires_at * 1000).toISOString(),
          expiresIn: Math.round((data.session.expires_at * 1000 - Date.now()) / 1000 / 60) + " minutes"
        });
        
        const timeToExpiry = data.session.expires_at * 1000 - Date.now();
        const shouldRefresh = timeToExpiry < 30 * 60 * 1000;
        
        if (shouldRefresh) {
          console.log("Session expiring soon, refreshing...");
          refreshAuthSession().then(success => {
            console.log("Auto-refresh session result:", success ? "Success" : "Failed");
          });
        }
      } else {
        console.log("No initial session found");
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
        <Route path="/record" element={
          <ProtectedRoute>
            <Record />
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

export default App;
