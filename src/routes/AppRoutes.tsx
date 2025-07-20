
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
import { useOnboardingState } from '@/hooks/use-onboarding-state';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { NativeNavigationGuard } from '@/components/navigation/NativeNavigationGuard';

const AppRoutes = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { onboardingComplete, loading: onboardingLoading, isReady } = useOnboardingState(user);

  // Enhanced AppRootRedirect with proper loading states
  const AppRootRedirect = () => {
    const isNative = nativeIntegrationService.isRunningNatively();

    console.log('[AppRoutes] AppRootRedirect', {
      isNative,
      hasUser: !!user,
      onboardingComplete,
      authLoading,
      onboardingLoading,
      isReady
    });

    // Handle OAuth callback parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    const hasOAuthParams = urlParams.has('access_token') || hashParams.has('access_token') ||
                          urlParams.has('code') || hashParams.has('code') ||
                          urlParams.has('error') || hashParams.has('error');

    if (hasOAuthParams) {
      console.log('[AppRoutes] OAuth callback detected, redirecting to auth');
      return <Navigate to={`/app/auth${window.location.search}${window.location.hash}`} replace />;
    }

    // For native apps, use the navigation guard
    if (isNative) {
      return (
        <NativeNavigationGuard
          onNavigationReady={(path) => {
            console.log('[AppRoutes] Native navigation ready, redirecting to:', path);
            window.location.href = path;
          }}
        >
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </NativeNavigationGuard>
      );
    }

    // For web, wait for all states to be ready before navigation
    if (authLoading || onboardingLoading || !isReady) {
      console.log('[AppRoutes] Web app still loading states');
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    // Web navigation logic
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

    console.log('[AppRoutes] RootRedirect', { isNative, hasUser: !!user, onboardingComplete });

    // For native apps, NEVER show marketing site - always redirect to app
    if (isNative) {
      console.log('[AppRoutes] Native environment detected at root, redirecting to app');
      return (
        <NativeNavigationGuard
          onNavigationReady={(path) => {
            console.log('[AppRoutes] Root native navigation ready, redirecting to:', path);
            window.location.href = path;
          }}
        >
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </NativeNavigationGuard>
      );
    }

    // Web behavior - show marketing site only for web
    console.log('[AppRoutes] Web environment, showing marketing site');
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
