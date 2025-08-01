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
import { MarketingContextProvider } from '@/contexts/MarketingContextProvider';
import { AppContextProvider } from '@/contexts/AppContextProvider';

const AppRoutes = () => {
  const { user } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const { session: validatedSession, isValid: hasValidSession, isLoading: sessionLoading } = useSessionValidation();

  // Enhanced app root redirect with session validation
  const AppRootRedirect = () => {
    const isNative = nativeIntegrationService.isRunningNatively();

    console.log('[AppRoutes] AppRootRedirect - isNative:', isNative, 'user:', !!user, 'validatedSession:', !!validatedSession, 'hasValidSession:', hasValidSession);

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

      // ENHANCED: For native apps, prioritize validated session over user context
      console.log('[AppRoutes] Native environment detected, checking session validation');
      
      // If we have a validated session, go directly to home
      if (hasValidSession && validatedSession) {
        console.log('[AppRoutes] Native app with validated session, redirecting to home');
        return <Navigate to="/app/home" replace />;
      }
      
      // Fallback to user context check
      if (!user && !validatedSession) {
        console.log('[AppRoutes] No user or session in native app, redirecting to onboarding');
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

    if (!user && !validatedSession) {
      return <Navigate to="/app/onboarding" replace />;
    }

    // If user is authenticated, go directly to home (ignore database onboarding flag)
    return <Navigate to="/app/home" replace />;
  };

  // Enhanced root redirect with session validation
  const RootRedirect = () => {
    const isNative = nativeIntegrationService.isRunningNatively();

    console.log('[AppRoutes] RootRedirect - isNative:', isNative, 'user:', !!user, 'validatedSession:', !!validatedSession);

    // CRITICAL: For native apps, NEVER show marketing site - always redirect to app
    if (isNative) {
      console.log('[AppRoutes] Native environment detected at root, checking session');
      
      // Prioritize validated session for immediate routing
      if (hasValidSession && validatedSession) {
        console.log('[AppRoutes] Native app with validated session, redirecting to home');
        return <Navigate to="/app/home" replace />;
      }
      
      if (!user && !validatedSession) {
        console.log('[AppRoutes] No user or session in native app, redirecting to onboarding');
        return <Navigate to="/app/onboarding" replace />;
      }

      // If user exists, go to home
      console.log('[AppRoutes] Native app user ready, redirecting to home');
      return <Navigate to="/app/home" replace />;
    }

    // Web behavior - show marketing site only for web
    console.log('[AppRoutes] Web environment, showing marketing site');
    return <MarketingContextProvider><Index /></MarketingContextProvider>;
  };

  return (
    <Routes>
      {/* Marketing Routes - no app context needed */}
      <Route element={<ViewportManager />}>
        {/* Root Route - context-aware */}
        <Route path="/" element={<RootRedirect />} />

        {/* Website Routes - only accessible in web context */}
        <Route path="/privacy-policy" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <MarketingContextProvider><PrivacyPolicyPage /></MarketingContextProvider>
        } />
        <Route path="/faq" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <MarketingContextProvider><FAQPage /></MarketingContextProvider>
        } />
        <Route path="/download" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <MarketingContextProvider><AppDownload /></MarketingContextProvider>
        } />
        <Route path="/blog" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <MarketingContextProvider><BlogPage /></MarketingContextProvider>
        } />
        <Route path="/blog/:slug" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <MarketingContextProvider><BlogPostPage /></MarketingContextProvider>
        } />

        {/* Catch-all route for marketing - context-aware */}
        <Route path="*" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <NotFound />
        } />
      </Route>

      {/* App Routes - wrapped with AppContextProvider */}
      <Route element={<AppContextProvider><ViewportManager /></AppContextProvider>}>
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
      </Route>
    </Routes>
  );
};

export default AppRoutes;
