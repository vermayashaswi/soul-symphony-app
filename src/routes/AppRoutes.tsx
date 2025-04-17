
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
import { isAppSubdomain } from './RouteHelpers';

const AppRoutes = () => {
  // Detect if we're on the app subdomain
  const isOnAppSubdomain = isAppSubdomain();
  
  return (
    <Routes>
      {/* Wrap all routes that need ViewportManager in a parent Route */}
      <Route element={<ViewportManager />}>
        {/* App subdomain routes - handle differently */}
        {isOnAppSubdomain ? (
          <>
            {/* Root of app subdomain */}
            <Route path="/" element={<OnboardingScreen />} />
            <Route path="/onboarding" element={<OnboardingScreen />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected app routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/home" element={<Home />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/smart-chat" element={<SmartChat />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Redirect /app/* paths to the root path equivalents */}
            <Route path="/app/*" element={<Navigate to="/" replace />} />
            
            {/* Content routes on app subdomain */}
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/app-download" element={<AppDownload />} />
          </>
        ) : (
          <>
            {/* Main website routes */}
            <Route path="/" element={<Index />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/download" element={<AppDownload />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            
            {/* Redirect app routes to app subdomain */}
            <Route path="/app" element={<Navigate to="https://app.soulo.online" replace />} />
            <Route path="/app/*" element={<Navigate to="https://app.soulo.online" replace />} />
            
            {/* Redirect legacy app routes to app subdomain */}
            <Route path="/auth" element={<Navigate to="https://app.soulo.online/auth" replace />} />
            <Route path="/onboarding" element={<Navigate to="https://app.soulo.online/onboarding" replace />} />
            <Route path="/home" element={<Navigate to="https://app.soulo.online/home" replace />} />
            <Route path="/journal" element={<Navigate to="https://app.soulo.online/journal" replace />} />
            <Route path="/insights" element={<Navigate to="https://app.soulo.online/insights" replace />} />
            <Route path="/chat" element={<Navigate to="https://app.soulo.online/chat" replace />} />
            <Route path="/smart-chat" element={<Navigate to="https://app.soulo.online/smart-chat" replace />} />
            <Route path="/settings" element={<Navigate to="https://app.soulo.online/settings" replace />} />
          </>
        )}
        
        {/* Catch-all route */}
        <Route path="*" element={<NotFound isAppSubdomain={isOnAppSubdomain} />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
