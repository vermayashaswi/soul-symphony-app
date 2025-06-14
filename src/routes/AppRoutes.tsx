
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

const AppRoutes = () => {
  console.log('[AppRoutes] Rendering routes');
  const { user } = useAuth();
  const { onboardingComplete } = useOnboarding();
  
  // This will be used for conditional rendering of the /app route
  const AppRootRedirect = () => {
    console.log('[AppRootRedirect] Auth status:', { 
      user: !!user, 
      onboardingComplete 
    });
    
    if (user) {
      if (onboardingComplete) {
        console.log('[AppRootRedirect] User logged in and onboarding complete, redirecting to /app/home');
        return <Navigate to="/app/home" replace />;
      } else {
        console.log('[AppRootRedirect] User logged in but onboarding not complete, redirecting to /app/onboarding');
        return <Navigate to="/app/onboarding" replace />;
      }
    } else {
      console.log('[AppRootRedirect] User not logged in, redirecting to /app/auth');
      return <Navigate to="/app/auth" replace />;
    }
  };
  
  return (
    <Routes>
      {/* Marketing Routes - NO ViewportManager wrapper, NO splash screen */}
      <Route index element={<Index />} />
      <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="faq" element={<FAQPage />} />
      <Route path="download" element={<AppDownload />} />
      <Route path="blog" element={<BlogPage />} />
      <Route path="blog/:slug" element={<BlogPostPage />} />
      
      {/* App Routes - WITH ViewportManager wrapper */}
      <Route path="app/*" element={<ViewportManager />}>
        <Route path="onboarding" element={<OnboardingScreen />} />
        <Route path="auth" element={<Auth />} />
        
        {/* Protected App Routes */}
        <Route path="" element={<ProtectedRoute />}>
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
      </Route>
      
      {/* Legacy Route Redirects */}
      <Route path="auth" element={<Navigate to="/app/auth" replace />} />
      <Route path="onboarding" element={<Navigate to="/app/onboarding" replace />} />
      <Route path="home" element={<Navigate to="/app/home" replace />} />
      <Route path="journal" element={<Navigate to="/app/journal" replace />} />
      <Route path="insights" element={<Navigate to="/app/insights" replace />} />
      <Route path="chat" element={<Navigate to="/app/chat" replace />} />
      <Route path="smart-chat" element={<Navigate to="/app/smart-chat" replace />} />
      <Route path="settings" element={<Navigate to="/app/settings" replace />} />
      
      {/* Catch-all route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
