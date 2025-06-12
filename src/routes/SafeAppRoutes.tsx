
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import EmergencyFallback from './EmergencyFallback';
import { useAuth } from '@/contexts/SimplifiedAuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';

// Lazy load components to prevent loading issues
const Index = React.lazy(() => import('@/pages/Index'));
const Home = React.lazy(() => import('@/pages/Home'));
const Journal = React.lazy(() => import('@/pages/Journal'));
const Insights = React.lazy(() => import('@/pages/Insights'));
const SmartChat = React.lazy(() => import('@/pages/SmartChat'));
const Chat = React.lazy(() => import('@/pages/Chat'));
const Auth = React.lazy(() => import('@/pages/Auth'));
const Settings = React.lazy(() => import('@/pages/Settings'));
const AppDownload = React.lazy(() => import('@/pages/AppDownload'));
const NotFound = React.lazy(() => import('@/pages/NotFound'));
const OnboardingScreen = React.lazy(() => import('@/components/onboarding/OnboardingScreen'));
const PrivacyPolicyPage = React.lazy(() => import('@/pages/legal/PrivacyPolicyPage'));
const FAQPage = React.lazy(() => import('@/pages/website/FAQPage'));
const BlogPage = React.lazy(() => import('@/pages/website/BlogPage'));
const BlogPostPage = React.lazy(() => import('@/pages/website/BlogPostPage'));

const SafeAppRoutes = () => {
  const location = useLocation();
  const [routeError, setRouteError] = useState<Error | null>(null);
  
  console.log('[SafeAppRoutes] Rendering at path:', location.pathname);

  // Reset error when location changes
  useEffect(() => {
    setRouteError(null);
  }, [location.pathname]);

  // Website-only routes that don't need auth context
  const isWebsiteRoute = () => {
    const websitePaths = [
      '/',
      '/privacy-policy',
      '/faq',
      '/download',
      '/blog'
    ];
    
    return websitePaths.some(path => 
      location.pathname === path || 
      (path === '/blog' && location.pathname.startsWith('/blog/'))
    );
  };

  // If this is a website route, render without auth dependencies
  if (isWebsiteRoute()) {
    console.log('[SafeAppRoutes] Rendering website route without auth');
    
    return (
      <ErrorBoundary fallback={<EmergencyFallback />}>
        <React.Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        }>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/download" element={<AppDownload />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </ErrorBoundary>
    );
  }

  // For app routes, use the protected route component
  return (
    <ErrorBoundary fallback={<EmergencyFallback error={routeError} />}>
      <ProtectedAppRoutes onError={setRouteError} />
    </ErrorBoundary>
  );
};

// Separate component for app routes that need auth
const ProtectedAppRoutes: React.FC<{ onError: (error: Error) => void }> = ({ onError }) => {
  const { user, isLoading } = useAuth();
  const { onboardingComplete } = useOnboarding();
  
  console.log('[ProtectedAppRoutes] State:', { 
    hasUser: !!user, 
    isLoading, 
    onboardingComplete 
  });

  // Simple app root redirect without complex logic
  const AppRootRedirect = () => {
    if (!user) {
      return <Navigate to="/app/onboarding" replace />;
    }
    
    if (!onboardingComplete) {
      return <Navigate to="/app/onboarding" replace />;
    }
    
    return <Navigate to="/app/home" replace />;
  };

  // Simple protected route wrapper
  const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      );
    }
    
    if (!user) {
      return <Navigate to="/app/onboarding" replace />;
    }
    
    return <>{children}</>;
  };

  try {
    return (
      <React.Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      }>
        <Routes>
          {/* App Routes */}
          <Route path="/app/onboarding" element={<OnboardingScreen />} />
          <Route path="/app/auth" element={<Auth />} />
          <Route path="/app" element={<AppRootRedirect />} />
          
          {/* Protected App Routes */}
          <Route path="/app/home" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          <Route path="/app/journal" element={
            <ProtectedRoute>
              <Journal />
            </ProtectedRoute>
          } />
          <Route path="/app/insights" element={
            <ProtectedRoute>
              <Insights />
            </ProtectedRoute>
          } />
          <Route path="/app/chat" element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } />
          <Route path="/app/smart-chat" element={
            <ProtectedRoute>
              <SmartChat />
            </ProtectedRoute>
          } />
          <Route path="/app/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          
          {/* Legacy Route Redirects */}
          <Route path="/auth" element={<Navigate to="/app/auth" replace />} />
          <Route path="/onboarding" element={<Navigate to="/app/onboarding" replace />} />
          <Route path="/home" element={<Navigate to="/app/home" replace />} />
          <Route path="/journal" element={<Navigate to="/app/journal" replace />} />
          <Route path="/insights" element={<Navigate to="/app/insights" replace />} />
          <Route path="/chat" element={<Navigate to="/app/chat" replace />} />
          <Route path="/smart-chat" element={<Navigate to="/app/smart-chat" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
          
          {/* Catch-all route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </React.Suspense>
    );
  } catch (error) {
    console.error('[ProtectedAppRoutes] Route error:', error);
    onError(error as Error);
    return <EmergencyFallback error={error as Error} />;
  }
};

export default SafeAppRoutes;
