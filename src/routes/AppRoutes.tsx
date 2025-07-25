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
import { useOnboarding } from '@/hooks/use-onboarding';
import { useSessionValidation } from '@/hooks/useSessionValidation';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

const AppRoutes = () => {
  const { user } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const { session: validatedSession, isValid: hasValidSession, isLoading: sessionLoading, timeoutReached } = useSessionValidation();

  // Simplified app root redirect with timeout protection
  const AppRootRedirect = () => {
    const isNative = nativeIntegrationService.isRunningNatively();

    // Add timeout protection to prevent infinite loading
    if (sessionLoading && !timeoutReached) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }

    console.log('[AppRoutes] AppRootRedirect - routing decision:', {
      isNative,
      hasUser: !!user,
      hasValidSession,
      timeoutReached
    });

    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    const hasOAuthParams = urlParams.has('access_token') || hashParams.has('access_token') ||
                          urlParams.has('code') || hashParams.has('code') ||
                          urlParams.has('error') || hashParams.has('error');

    if (hasOAuthParams) {
      return <Navigate to={`/app/auth${window.location.search}${window.location.hash}`} replace />;
    }

    // For native apps
    if (isNative) {
      if (hasValidSession || user) {
        return <Navigate to="/app/home" replace />;
      }
      return <Navigate to="/app/onboarding" replace />;
    }

    // For web apps
    if (!user && !hasValidSession) {
      return <Navigate to="/app/onboarding" replace />;
    }

    return <Navigate to="/app/home" replace />;
  };

  // Simplified root redirect with timeout protection  
  const RootRedirect = () => {
    const isNative = nativeIntegrationService.isRunningNatively();

    // Add timeout protection
    if (sessionLoading && !timeoutReached) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }

    console.log('[AppRoutes] RootRedirect - routing decision:', {
      isNative,
      hasUser: !!user,
      hasValidSession,
      timeoutReached
    });

    // For native apps, NEVER show marketing site - always redirect to app
    if (isNative) {
      if (hasValidSession || user) {
        return <Navigate to="/app/home" replace />;
      }
      return <Navigate to="/app/onboarding" replace />;
    }

    // Web behavior - show marketing site only for web
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
