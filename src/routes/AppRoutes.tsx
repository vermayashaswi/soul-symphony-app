
import React from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
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
import PrivacyPolicyPage from '@/pages/legal/PrivacyPolicyPage';
import FAQPage from '@/pages/website/FAQPage';
import BlogPage from '@/pages/website/BlogPage';
import BlogPostPage from '@/pages/website/BlogPostPage';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';
import MobileNavigation from '@/components/MobileNavigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useIsMobile } from '@/hooks/use-mobile';
import { isAppRoute } from './RouteHelpers';

const AppRoutes = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const isMobile = useIsMobile();
  
  // Comprehensive list of routes where navigation should be hidden
  const onboardingOrAuthPaths = [
    '/app/onboarding',
    '/app/auth',
    '/onboarding',
    '/auth',
    '/' // Also hide on root path
  ];
  
  // Check if current path is in the list of paths where navigation should be hidden
  const isOnboardingOrAuth = onboardingOrAuthPaths.includes(location.pathname);
  
  // This will be used for conditional rendering of the /app route
  const AppRootRedirect = () => {
    if (user) {
      if (onboardingComplete) {
        // If user is logged in and onboarding is complete, go to home
        return <Navigate to="/app/home" replace />;
      } else {
        // If user is logged in but onboarding is not complete, go to onboarding
        return <Navigate to="/app/onboarding" replace />;
      }
    } else {
      // If user is not logged in, go to onboarding
      return <Navigate to="/app/onboarding" replace />;
    }
  };
  
  return (
    <>
      <div className={`app-container ${isMobile ? 'mobile-view' : 'desktop-view'}`}>
        <Routes>
          {/* Website Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/download" element={<AppDownload />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          
          {/* App Routes */}
          <Route path="/app/onboarding" element={<OnboardingScreen />} />
          <Route path="/app/auth" element={<Auth />} />
          
          {/* Protected App Routes */}
          <Route path="/app" element={<ProtectedRoute />}>
            <Route index element={<AppRootRedirect />} />
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
        </Routes>
      </div>
      
      {/* Only display mobile navigation when:
          1. We're on an app route
          2. User is logged in
          3. We're not on onboarding/auth screens
          4. If we're on /app, we also check if onboarding is complete */}
      {isAppRoute(location.pathname) && 
       user && 
       !isOnboardingOrAuth && 
       onboardingComplete && (
        <MobileNavigation onboardingComplete={onboardingComplete} />
      )}
    </>
  );
};

export default AppRoutes;
