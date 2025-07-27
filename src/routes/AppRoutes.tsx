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
import OptimizedViewportManager from './OptimizedViewportManager';
import PrivacyPolicyPage from '@/pages/legal/PrivacyPolicyPage';
import FAQPage from '@/pages/website/FAQPage';
import BlogPage from '@/pages/website/BlogPage';
import BlogPostPage from '@/pages/website/BlogPostPage';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';
import SessionRouter from '@/components/routing/SessionRouter';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useSimpleOnboarding } from '@/hooks/useSimpleOnboarding';
import { optimizedRouteService } from '@/services/optimizedRouteService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

const AppRoutes = () => {
  const { user, isAuthenticated, hasValidSession } = useOptimizedAuth();
  const { onboardingComplete } = useSimpleOnboarding();

  // Enhanced app root redirect with optimized checks
  const AppRootRedirect = () => {
    const isNative = optimizedRouteService.isNativeApp();

    console.log('[AppRoutes] AppRootRedirect - isNative:', isNative, 'user:', !!user, 'hasValidSession:', hasValidSession);

    // CRITICAL: For native apps, handle OAuth callback parameters properly
    if (isNative) {
      // Check for OAuth callback deep links
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
      const hasOAuthParams = urlParams.has('access_token') || hashParams.has('access_token') ||
                            urlParams.has('code') || hashParams.has('code') ||
                            urlParams.has('error') || hashParams.has('error');

      if (hasOAuthParams) {
        console.log('[AppRoutes] OAuth callback detected in native app, processing auth');
        return <Navigate to={`/app/auth${window.location.search}${window.location.hash}`} replace />;
      }

      // For native apps, use optimized auth checks
      console.log('[AppRoutes] Native environment detected, checking auth status');
      
      // If authenticated, go directly to home
      if (isAuthenticated && hasValidSession) {
        console.log('[AppRoutes] Native app authenticated, redirecting to home');
        return <Navigate to="/app/home" replace />;
      }
      
      // If no authentication, go to onboarding
      if (!isAuthenticated) {
        console.log('[AppRoutes] No auth in native app, redirecting to onboarding');
        return <Navigate to="/app/onboarding" replace />;
      }

      // If user exists but session validation is still loading, go to home anyway
      console.log('[AppRoutes] Native app user authenticated, redirecting to home');
      return <Navigate to="/app/home" replace />;
    }

    // Web behavior - prioritize authentication status over onboarding flag
    console.log('[AppRoutes] Web environment, using standard flow');

    // Check for web OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    const hasOAuthParams = urlParams.has('access_token') || hashParams.has('access_token') ||
                          urlParams.has('code') || hashParams.has('code') ||
                          urlParams.has('error') || hashParams.has('error');

    if (hasOAuthParams) {
      console.log('[AppRoutes] OAuth callback detected in web, redirecting to auth page');
      return <Navigate to={`/app/auth${window.location.search}${window.location.hash}`} replace />;
    }

    if (!isAuthenticated) {
      return <Navigate to="/app/onboarding" replace />;
    }

    // If user is authenticated, go directly to home (ignore database onboarding flag)
    return <Navigate to="/app/home" replace />;
  };

  // Enhanced root redirect with optimized checks
  const RootRedirect = () => {
    const isNative = optimizedRouteService.isNativeApp();

    console.log('[AppRoutes] RootRedirect - isNative:', isNative, 'user:', !!user, 'isAuthenticated:', isAuthenticated);

    // CRITICAL: For native apps, NEVER show marketing site - always redirect to app
    if (isNative) {
      console.log('[AppRoutes] Native environment detected at root, checking session');
      
      // Use optimized auth status for immediate routing
      if (isAuthenticated && hasValidSession) {
        console.log('[AppRoutes] Native app authenticated, redirecting to home');
        return <Navigate to="/app/home" replace />;
      }
      
      if (!isAuthenticated) {
        console.log('[AppRoutes] No auth in native app, redirecting to onboarding');
        return <Navigate to="/app/onboarding" replace />;
      }

      // If user exists, go to home
      console.log('[AppRoutes] Native app user ready, redirecting to home');
      return <Navigate to="/app/home" replace />;
    }

    // Web behavior - show marketing site only for web
    console.log('[AppRoutes] Web environment, showing marketing site');
    return <Index />;
  };

  return (
    <Routes>
      <Route element={<OptimizedViewportManager />}>
        {/* Root Route - context-aware */}
        <Route path="/" element={<RootRedirect />} />

        {/* Website Routes - only accessible in web context */}
        <Route path="/privacy-policy" element={
          optimizedRouteService.isNativeApp() ?
          <Navigate to="/app/home" replace /> :
          <PrivacyPolicyPage />
        } />
        <Route path="/faq" element={
          optimizedRouteService.isNativeApp() ?
          <Navigate to="/app/home" replace /> :
          <FAQPage />
        } />
        <Route path="/download" element={
          optimizedRouteService.isNativeApp() ?
          <Navigate to="/app/home" replace /> :
          <AppDownload />
        } />
        <Route path="/blog" element={
          optimizedRouteService.isNativeApp() ?
          <Navigate to="/app/home" replace /> :
          <BlogPage />
        } />
        <Route path="/blog/:slug" element={
          optimizedRouteService.isNativeApp() ?
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
          optimizedRouteService.isNativeApp() ?
          <Navigate to="/app/home" replace /> :
          <NotFound />
        } />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
