
import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Index from '@/pages/Index';
import Home from '@/pages/Home';
import Journal from '@/pages/Journal';
import Insights from '@/pages/Insights';
import SmartChat from '@/pages/SmartChat';
import Chat from '@/pages/Chat';
import ProtectedRoute from './ProtectedRoute';
import Auth from '@/pages/Auth';
import Settings from '@/pages/Settings';
import AppDownload from '@/pages/AppDownload';
import NotFound from '@/pages/NotFound';
import ViewportManager from './ViewportManager';
import PrivacyPolicyPage from '@/pages/legal/PrivacyPolicyPage';
import FAQPage from '@/pages/website/FAQPage';
import BlogPage from '@/pages/website/BlogPage';
import BlogPostPage from '@/pages/website/BlogPostPage';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

const AppRoutes = () => {
  const { user } = useAuth();
  const { onboardingComplete } = useOnboarding();
  
  // Handle /app root route redirects with native context awareness
  const AppRootRedirect = () => {
    const isNative = nativeIntegrationService.isRunningNatively();
    
    // For native apps, always redirect to app routes
    if (isNative) {
      if (!user) {
        return <Navigate to="/app/onboarding" replace />;
      }
      
      if (!onboardingComplete) {
        return <Navigate to="/app/onboarding" replace />;
      }
      
      return <Navigate to="/app/home" replace />;
    }
    
    // Web behavior (existing logic)
    if (!user) {
      return <Navigate to="/app/onboarding" replace />;
    }
    
    if (!onboardingComplete) {
      return <Navigate to="/app/onboarding" replace />;
    }
    
    return <Navigate to="/app/home" replace />;
  };

  // Handle root route redirects with native context
  const RootRedirect = () => {
    const isNative = nativeIntegrationService.isRunningNatively();
    
    // For native apps, always redirect to app interface
    if (isNative) {
      if (!user) {
        return <Navigate to="/app/onboarding" replace />;
      }
      
      if (!onboardingComplete) {
        return <Navigate to="/app/onboarding" replace />;
      }
      
      return <Navigate to="/app/home" replace />;
    }
    
    // Web behavior - show marketing site
    return <Index />;
  };
  
  return (
    <Routes>
      {/* Wrap all routes that need ViewportManager in a parent Route */}
      <Route element={<ViewportManager />}>
        {/* Root Route - context-aware */}
        <Route path="/" element={<RootRedirect />} />
        
        {/* Website Routes - only accessible in web context */}
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/download" element={<AppDownload />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        
        {/* App Routes */}
        {/* Public app routes (no auth required) */}
        <Route path="/app/onboarding" element={<OnboardingScreen />} />
        <Route path="/app/auth" element={<Auth />} />
        
        {/* Root app route with smart redirect */}
        <Route path="/app" element={<AppRootRedirect />} />
        
        {/* Protected App Routes */}
        <Route path="/app" element={<ProtectedRoute />}>
          <Route path="home" element={<Home />} />
          <Route path="journal" element={<Journal />} />
          <Route path="insights" element={
            <React.Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
              <Insights />
            </React.Suspense>
          } />
          <Route path="chat" element={<Chat />} />
          <Route path="smart-chat" element={<SmartChat />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        
        {/* Legacy Route Redirects - all app features redirect to /app/ routes */}
        <Route path="/auth" element={<Navigate to="/app/auth" replace />} />
        <Route path="/onboarding" element={<Navigate to="/app/onboarding" replace />} />
        <Route path="/home" element={<Navigate to="/app/home" replace />} />
        <Route path="/journal" element={<Navigate to="/app/journal" replace />} />
        <Route path="/insights" element={<Navigate to="/app/insights" replace />} />
        <Route path="/chat" element={<Navigate to="/app/chat" replace />} />
        <Route path="/smart-chat" element={<Navigate to="/app/smart-chat" replace />} />
        <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
        
        {/* Catch-all route */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
