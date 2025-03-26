
import { Routes, Route, useLocation } from "react-router-dom";
import Index from "@/pages/Index";
import Journal from "@/pages/Journal";
import Record from "@/pages/Record";
import Insights from "@/pages/Insights";
import Chat from "@/pages/Chat";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import Auth from "@/pages/Auth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import AuthStateListener from "@/components/auth/AuthStateListener";
import AuthCallback from "@/components/auth/AuthCallback";
import { useEffect } from "react";

const AppRoutes = () => {
  const location = useLocation();
  
  // Log initial route for debugging
  useEffect(() => {
    console.log("AppRoutes rendering on path:", location.pathname, "with origin:", window.location.origin);
  }, [location.pathname]);
  
  return (
    <AppLayout>
      {/* Only render AuthStateListener once */}
      <AuthStateListener />
      
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        
        {/* Handle all auth callback paths - IMPORTANT: Must match Google Console */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        {/* Legacy callback paths - redirect to the main callback */}
        <Route path="/callback" element={<AuthCallback />} />
        
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

export default AppRoutes;
