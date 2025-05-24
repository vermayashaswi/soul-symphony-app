
import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Index from '@/pages/Index';
import Home from '@/pages/Home';
import Journal from '@/pages/Journal';
import Insights from '@/pages/Insights';
import SmartChat from '@/pages/SmartChat';
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
  console.log('Rendering AppRoutes component');
  const { user } = useAuth();
  const { onboardingComplete } = useOnboarding();
  
  // This will be used for conditional rendering of the /app route
  const AppRootRedirect = () => {
    console.log('AppRootRedirect - Auth status:', { 
      user: !!user, 
      onboardingComplete 
    });
    
    if (user) {
      if (onboardingComplete) {
        // If user is logged in and onboarding is complete, go to home
        console.log('User logged in and onboarding complete, redirecting to /app/home');
        return <Navigate to="/app/home" replace />;
      } else {
        // If user is logged in but onboarding is not complete, go to onboarding
        console.log('User logged in but onboarding not complete, redirecting to /app/onboarding');
        return <Navigate to="/app/onboarding" replace />;
      }
    } else {
      // If user is not logged in, go to onboarding
      console.log('User not logged in, redirecting to /app/onboarding');
      return <Navigate to="/app/onboarding" replace />;
    }
  };
  
  return (
    <Routes>
      {/* Wrap all routes that need ViewportManager in a parent Route */}
      <Route element={<ViewportManager />}>
        {/* Website Routes */}
        <Route path="/" element={<Index />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/download" element={<AppDownload />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        
        {/* App Routes */}
        <Route path="/app" element={<AppRootRedirect />} />
        <Route path="/app/onboarding" element={<OnboardingScreen />} />
        <Route path="/app/auth" element={<Auth />} />
        
        {/* Protected App Routes */}
        <Route path="/app" element={<ProtectedRoute />}>
          <Route path="home" element={<Home />} />
          <Route path="journal" element={<Journal />} />
          <Route path="insights" element={
            <React.Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
              <Insights />
            </React.Suspense>
          } />
          {/* Redirect chat to smart-chat */}
          <Route path="chat" element={<Navigate to="/app/smart-chat" replace />} />
          <Route path="smart-chat" element={<SmartChat />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        
        {/* Legacy Route Redirects - all app features redirect to /app/ routes */}
        <Route path="/auth" element={<Navigate to="/app/auth" replace />} />
        <Route path="/onboarding" element={<Navigate to="/app/onboarding" replace />} />
        <Route path="/home" element={<Navigate to="/app/home" replace />} />
        <Route path="/journal" element={<Navigate to="/app/journal" replace />} />
        <Route path="/insights" element={<Navigate to="/app/insights" replace />} />
        <Route path="/chat" element={<Navigate to="/app/smart-chat" replace />} />
        <Route path="/smart-chat" element={<Navigate to="/app/smart-chat" replace />} />
        <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
        
        {/* Catch-all route */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
