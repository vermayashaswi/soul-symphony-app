
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "sonner";
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

// New wrapper component to conditionally apply MobilePreviewFrame
const MobilePreviewWrapper = ({ children }: { children: React.ReactNode }) => {
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  return mobileDemo ? <MobilePreviewFrame>{children}</MobilePreviewFrame> : <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // Ensure all hooks are called at the top level
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
  const isMobile = useIsMobile();
  const location = useLocation();
  const { user } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  const shouldShowMobileNav = isMobile || mobileDemo;

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
  
  // Always render the navbar component but let it decide visibility internally
  const navBar = <MobileNavbar />;
  
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
        {/* Redirect /chat to /smart-chat for all devices */}
        <Route path="/chat" element={
          <Navigate to="/smart-chat" replace />
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

      {navBar}
    </>
  );
};

// Now update the MobileNavbar component to handle its own visibility
<lov-write file_path="src/components/mobile/MobileNavbar.tsx">
import { Home, Book, BarChart2, MessageSquare, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

const MobileNavbar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  const shouldShow = (isMobile || mobileDemo) && (user || location.pathname === '/');
  
  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/journal', label: 'Journal', icon: Book },
    { path: '/insights', label: 'Insights', icon: BarChart2 },
    { path: '/smart-chat', label: 'Chat', icon: MessageSquare },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  // Don't render anything if we shouldn't show the navbar
  if (!shouldShow) {
    return null;
  }

  return (
    <motion.div 
      className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t flex items-center justify-around z-50 px-1"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {navItems.map(item => {
        const isActive = location.pathname === item.path;
        
        return (
          <Link 
            key={item.path} 
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full pt-1",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <div className="relative">
              {isActive && (
                <motion.div
                  layoutId="nav-pill-mobile"
                  className="absolute -inset-1 bg-primary/10 rounded-full"
                  transition={{ type: "spring", duration: 0.6 }}
                />
              )}
              <item.icon className="relative h-5 w-5" />
            </div>
            <span className="text-xs mt-1">{item.label}</span>
          </Link>
        );
      })}
    </motion.div>
  );
};

export default MobileNavbar;
