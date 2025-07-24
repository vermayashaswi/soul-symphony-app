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
import SessionRouter from '@/components/routing/SessionRouter';
import { useAuth } from '@/contexts/AuthContext';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

const AppRoutes = () => {
  const { user } = useAuth();

  // Enhanced app root redirect - simplified
  const AppRootRedirect = () => {
    const isNative = nativeIntegrationService.isRunningNatively();

    if (isNative) {
      // For native apps, always redirect to app content
      if (user) {
        return <Navigate to="/app/home" replace />;
      } else {
        return <Navigate to="/app/onboarding" replace />;
      }
    }

    // Web behavior - check auth status
    if (!user) {
      return <Navigate to="/app/onboarding" replace />;
    }

    return <Navigate to="/app/home" replace />;
  };

  // Root redirect - simplified
  const RootRedirect = () => {
    const isNative = nativeIntegrationService.isRunningNatively();

    if (isNative) {
      // Native apps: always redirect to app
      if (user) {
        return <Navigate to="/app/home" replace />;
      } else {
        return <Navigate to="/app/onboarding" replace />;
      }
    }

    // Web: show marketing site
    return <Index />;
  };

  return (
    <Routes>
      <Route element={<ViewportManager />}>
        {/* Root Route - context-aware */}
        <Route path="/" element={<RootRedirect />} />

        {/* Website Routes - only accessible in web context */}
        <Route path="/privacy-policy" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <PrivacyPolicyPage />
        } />
        <Route path="/faq" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <FAQPage />
        } />
        <Route path="/download" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <AppDownload />
        } />
        <Route path="/blog" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <BlogPage />
        } />
        <Route path="/blog/:slug" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <BlogPostPage />
        } />

        {/* App Routes */}
        {/* Public app routes (no auth required) */}
        <Route path="/app/onboarding" element={
          <SessionRouter>
            <OnboardingScreen />
          </SessionRouter>
        } />
        <Route path="/app/auth" element={
          <SessionRouter>
            <Auth />
          </SessionRouter>
        } />

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

        {/* Catch-all route - context-aware */}
        <Route path="*" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <NotFound />
        } />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
