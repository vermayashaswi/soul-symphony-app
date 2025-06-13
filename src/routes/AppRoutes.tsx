
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Index from '@/pages/Index';
import Home from '@/pages/Home';
import Journal from '@/pages/Journal';
import Insights from '@/pages/Insights';
import SmartChat from '@/pages/SmartChat';
import Chat from '@/pages/Chat';
import Splash from '@/pages/Splash';
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
import { useIsMobile } from '@/hooks/use-mobile';

const AppRoutes = () => {
  console.log('Rendering AppRoutes component');
  const { user } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const isMobile = useIsMobile();
  
  // Enhanced redirect logic for mobile-first app experience
  const AppRootRedirect = () => {
    console.log('AppRootRedirect - Auth status:', { 
      user: !!user, 
      onboardingComplete,
      isMobile: isMobile.isMobile
    });
    
    // For mobile/app contexts, always route through splash first
    if (isMobile.isMobile && !window.location.pathname.includes('/splash')) {
      console.log('Mobile context detected, ensuring splash flow');
      return <Navigate to="/app/splash" replace />;
    }
    
    if (user) {
      if (onboardingComplete) {
        console.log('User logged in and onboarding complete, redirecting to /app/home');
        return <Navigate to="/app/home" replace />;
      } else {
        console.log('User logged in but onboarding not complete, redirecting to /app/onboarding');
        return <Navigate to="/app/onboarding" replace />;
      }
    } else {
      console.log('User not logged in, redirecting to /app/auth');
      return <Navigate to="/app/auth" replace />;
    }
  };
  
  return (
    <Routes>
      {/* Wrap all routes that need ViewportManager in a parent Route */}
      <Route element={<ViewportManager />}>
        {/* Website Routes - Desktop fallback */}
        <Route path="/" element={<Index />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/download" element={<AppDownload />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        
        {/* App Routes - Mobile-first priority */}
        <Route path="/app/splash" element={<Splash />} />
        <Route path="/app/onboarding" element={<OnboardingScreen />} />
        <Route path="/app/auth" element={<Auth />} />
        
        {/* Protected App Routes */}
        <Route path="/app" element={<ProtectedRoute />}>
          <Route index element={<AppRootRedirect />} />
          <Route path="home" element={<Home />} />
          <Route path="journal" element={<Journal />} />
          <Route path="insights" element={
            <React.Suspense fallback={
              <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p>Loading Insights...</p>
                </div>
              </div>
            }>
              <Insights />
            </React.Suspense>
          } />
          <Route path="chat" element={<Chat />} />
          <Route path="smart-chat" element={<SmartChat />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        
        {/* Legacy Route Redirects - Enhanced for mobile */}
        <Route path="/auth" element={<Navigate to="/app/auth" replace />} />
        <Route path="/onboarding" element={<Navigate to="/app/onboarding" replace />} />
        <Route path="/home" element={<Navigate to="/app/home" replace />} />
        <Route path="/journal" element={<Navigate to="/app/journal" replace />} />
        <Route path="/insights" element={<Navigate to="/app/insights" replace />} />
        <Route path="/chat" element={<Navigate to="/app/chat" replace />} />
        <Route path="/smart-chat" element={<Navigate to="/app/smart-chat" replace />} />
        <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
        
        {/* Mobile app shortcuts - direct access routes */}
        <Route path="/record" element={<Navigate to="/app/home" replace />} />
        <Route path="/voice" element={<Navigate to="/app/home" replace />} />
        <Route path="/soulnet" element={<Navigate to="/app/insights" replace />} />
        
        {/* Catch-all route */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
