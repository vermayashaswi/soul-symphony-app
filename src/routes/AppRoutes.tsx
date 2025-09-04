import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
import ProfileOnboarding from '@/pages/ProfileOnboarding';

const AppRoutes = () => {
  const { user } = useAuth();
  const { onboardingComplete } = useOnboarding();
  const { session: validatedSession, isValid: hasValidSession, isLoading: sessionLoading } = useSessionValidation();
  
  // Profile onboarding check hook
  const useProfileOnboarding = () => {
    const [profileOnboardingComplete, setProfileOnboardingComplete] = React.useState<boolean | null>(null);
    
    React.useEffect(() => {
      const checkProfileOnboarding = async () => {
        if (!user) return;
        
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('profile_onboarding_completed')
            .eq('id', user.id)
            .single();
          
          if (error) {
            console.error('Error checking profile onboarding:', error);
            setProfileOnboardingComplete(false);
            return;
          }
          
          setProfileOnboardingComplete(data?.profile_onboarding_completed || false);
        } catch (error) {
          console.error('Error in profile onboarding check:', error);
          setProfileOnboardingComplete(false);
        }
      };
      
      checkProfileOnboarding();
    }, [user]);
    
    return profileOnboardingComplete;
  };
  
  const profileOnboardingComplete = useProfileOnboarding();

  // Enhanced app root redirect with session validation
  const AppRootRedirect = () => {
    const isNative = nativeIntegrationService.isRunningNatively();

    console.log('[AppRoutes] AppRootRedirect - isNative:', isNative, 'user:', !!user, 'validatedSession:', !!validatedSession, 'hasValidSession:', hasValidSession, 'profileOnboarding:', profileOnboardingComplete);

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
      
      // If we have a validated session, check profile onboarding
      if (hasValidSession && validatedSession) {
        console.log('[AppRoutes] Native app with validated session, checking profile onboarding');
        if (profileOnboardingComplete === false) {
          return <Navigate to="/app/profile-onboarding" replace />;
        }
        return <Navigate to="/app/home" replace />;
      }
      
      // Fallback to user context check
      if (!user && !validatedSession) {
        console.log('[AppRoutes] No user or session in native app, redirecting to onboarding');
        return <Navigate to="/app/onboarding" replace />;
      }

      // If user exists but session validation is still loading, check profile onboarding  
      console.log('[AppRoutes] Native app user authenticated, checking profile onboarding');
      if (profileOnboardingComplete === false) {
        return <Navigate to="/app/profile-onboarding" replace />;
      }
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

    const lastAppPath = (() => { try { return localStorage.getItem('lastAppPath'); } catch { return null; } })();

    if (!user && !validatedSession) {
      return <Navigate to="/app/onboarding" replace />;
    }

    // If user is authenticated, check profile onboarding first
    if (profileOnboardingComplete === false) {
      return <Navigate to="/app/profile-onboarding" replace />;
    }
    return <Navigate to={lastAppPath && lastAppPath.startsWith('/app/') ? lastAppPath : '/app/home'} replace />;
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
        console.log('[AppRoutes] Native app with validated session, checking profile onboarding');
        if (profileOnboardingComplete === false) {
          return <Navigate to="/app/profile-onboarding" replace />;
        }
        return <Navigate to="/app/home" replace />;
      }
      
      if (!user && !validatedSession) {
        console.log('[AppRoutes] No user or session in native app, redirecting to onboarding');
        return <Navigate to="/app/onboarding" replace />;
      }

      // If user exists, check profile onboarding
      console.log('[AppRoutes] Native app user ready, checking profile onboarding');
      if (profileOnboardingComplete === false) {
        return <Navigate to="/app/profile-onboarding" replace />;
      }
      return <Navigate to="/app/home" replace />;
    }

    // Web behavior - if authenticated, go to last app path; else show marketing site
    console.log('[AppRoutes] Web environment at root');
    const lastAppPath = (() => { try { return localStorage.getItem('lastAppPath'); } catch { return null; } })();
    if (user || validatedSession) {
      if (profileOnboardingComplete === false) {
        return <Navigate to="/app/profile-onboarding" replace />;
      }
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
        <Route path="/app/profile-onboarding" element={
          <SessionRouter>
            <ProfileOnboarding />
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
    </AppSessionProvider>
  );
};

export default AppRoutes;
