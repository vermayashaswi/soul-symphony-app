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
import AccountDeletion from '@/pages/AccountDeletion';
import DataDeletion from '@/pages/DataDeletion';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';
import SessionRouter from '@/components/routing/SessionRouter';
import { AppSessionProvider } from '@/components/session/AppSessionProvider';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useSessionValidation } from '@/hooks/useSessionValidation';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import NativeAuthDiagnostics from '@/pages/NativeAuthDiagnostics';

const AppRoutes = () => {
  const { user } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const { session: validatedSession, isValid: hasValidSession, isLoading: sessionLoading } = useSessionValidation();

  // Simplified app root redirect - navigation logic moved to AppInitializationContext
  const AppRootRedirect = () => {
    const lastAppPath = (() => { try { return localStorage.getItem('lastAppPath'); } catch { return null; } })();

    if (!user && !validatedSession) {
      return <Navigate to="/app/onboarding" replace />;
    }

    // If user is authenticated, go to last in-app path when available
    return <Navigate to={lastAppPath && lastAppPath.startsWith('/app/') ? lastAppPath : '/app/home'} replace />;
  };

  // Simplified root redirect - navigation logic moved to AppInitializationContext
  const RootRedirect = () => {
    // All complex navigation logic is now handled by AppInitializationContext
    // This component just handles simple routing for authenticated users
    const lastAppPath = (() => { try { return localStorage.getItem('lastAppPath'); } catch { return null; } })();
    if (user || validatedSession) {
      return <Navigate to={lastAppPath && lastAppPath.startsWith('/app/') ? lastAppPath : '/app/home'} replace />;
    }
    return <Index />;
  };

  return (
    <AppSessionProvider>
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
        <Route path="/account-deletion" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <AccountDeletion />
        } />
        <Route path="/data-deletion" element={
          nativeIntegrationService.isRunningNatively() ?
          <Navigate to="/app/home" replace /> :
          <DataDeletion />
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
        <Route path="/app/native-auth-diagnostics" element={<NativeAuthDiagnostics />} />

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
    </AppSessionProvider>
  );
};

export default AppRoutes;
