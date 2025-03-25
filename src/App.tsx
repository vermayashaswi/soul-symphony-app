
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
import { refreshAuthSession, createOrUpdateSession, endUserSession } from "./utils/audio/auth-utils";

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
  const [sessionChecked, setSessionChecked] = useState(false);
  
  useEffect(() => {
    // Only attempt to refresh once
    if (!isLoading && !user && !refreshAttempted) {
      console.log("Protected route: No user found, attempting to refresh session", {
        path: location.pathname
      });
      
      refreshAuthSession(false).then(success => {
        console.log("Session refresh attempt completed:", success ? "Success" : "Failed");
        setRefreshAttempted(true);
        setSessionChecked(true);
      }).catch(() => {
        setRefreshAttempted(true);
        setSessionChecked(true);
      });
    } else if (!refreshAttempted && (user || isLoading)) {
      // Mark as checked if we have a user or still loading
      setSessionChecked(true);
    }
    
    // Track session when user accesses a protected route - but don't block rendering on this
    if (user && !isLoading) {
      createOrUpdateSession(user.id, location.pathname)
        .catch(err => {
          console.error("Error tracking session:", err);
          // Don't block the app flow on session tracking errors
        });
    }
  }, [user, isLoading, location, refreshAttempted]);
  
  // Show loading state only while doing initial check
  if (isLoading && !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Once check is done, either show content or redirect
  if (user) {
    return <>{children}</>;
  }
  
  if (sessionChecked) {
    console.log("Redirecting to auth from protected route:", location.pathname);
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  // Fallback loading state
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
  const { user } = useAuth();
  
  useEffect(() => {
    console.log("Setting up Supabase auth debugging listener");
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event outside React context:", event, session?.user?.email);
      
      // Track session events - but don't block rendering on this
      if (event === 'SIGNED_IN' && session?.user) {
        createOrUpdateSession(session.user.id, window.location.pathname)
          .catch(err => {
            console.error("Error creating session on sign in:", err);
            // Don't block the app flow on session tracking errors
          });
      } else if (event === 'SIGNED_OUT' && user) {
        endUserSession(user.id)
          .catch(err => {
            console.error("Error ending session on sign out:", err);
            // Don't block the app flow on session tracking errors
          });
      }
    });
    
    // Only do initial session checks once at startup - don't refresh on every route change
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
        
        // Create or update session for initial session - but don't block rendering on this
        if (data.session.user.id) {
          createOrUpdateSession(data.session.user.id, window.location.pathname)
            .catch(err => {
              console.error("Error tracking session on initial load:", err);
              // Don't block the app flow on session tracking errors
            });
        }
      } else {
        console.log("No initial session found");
      }
    });
    
    // Cleanup function
    return () => {
      subscription.unsubscribe();
    };
  }, [user]);
  
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
