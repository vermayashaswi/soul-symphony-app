import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useOptimizedAuthContext } from '@/contexts/OptimizedAuthContext';
import { useOptimizedSubscription } from '@/contexts/OptimizedSubscriptionContext';
import { optimizedRouteService } from '@/services/optimizedRouteService';
import { useSimpleOnboarding } from '@/hooks/useSimpleOnboarding';
import { Suspense, lazy, useMemo } from 'react';
import OptimizedViewportManager from './OptimizedViewportManager';

// Lazy load components
const IndexPage = lazy(() => import('@/pages/Index'));
const HomePage = lazy(() => import('@/pages/Home'));
const AuthPage = lazy(() => import('@/pages/Auth'));
const JournalCapturePage = lazy(() => import('@/pages/Journal'));
const OnboardingPage = lazy(() => import('@/components/onboarding/OnboardingScreen'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const InsightsPage = lazy(() => import('@/pages/Insights'));
const SubscriptionPage = lazy(() => import('@/pages/AppDownload'));

// Loading component for Suspense
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useOptimizedAuthContext();
  const { onboardingComplete } = useSimpleOnboarding();
  const isNative = optimizedRouteService.isNativeApp();

  // For native apps, allow immediate access if localStorage indicates auth
  if (isNative && !isLoading) {
    const hasStoredAuth = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
    if (hasStoredAuth) {
      return <>{children}</>;
    }
  }

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/app/auth" replace />;
  }

  if (onboardingComplete === false) {
    return <Navigate to="/app/onboarding" replace />;
  }

  return <>{children}</>;
};

// Auth route wrapper
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useOptimizedAuthContext();
  const isNative = optimizedRouteService.isNativeApp();

  // Quick check for native apps
  if (isNative && !isLoading) {
    const hasStoredAuth = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
    if (hasStoredAuth) {
      return <Navigate to="/app/home" replace />;
    }
  }

  if (isLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/app/home" replace />;
  }

  return <>{children}</>;
};

export default function OptimizedAppRoutes() {
  const location = useLocation();
  const isNative = optimizedRouteService.isNativeApp();

  // Memoize route checks for performance
  const routeInfo = useMemo(() => ({
    isAppRoute: optimizedRouteService.isAppRoute(location.pathname),
    isWebsiteRoute: optimizedRouteService.isWebsiteRoute(location.pathname)
  }), [location.pathname]);

  // For native apps, redirect root to app
  if (isNative && location.pathname === '/') {
    return <Navigate to="/app/home" replace />;
  }

  return (
    <Routes>
      {/* App routes */}
      <Route path="/app" element={<OptimizedViewportManager />}>
        <Route index element={<Navigate to="/app/home" replace />} />
        
        <Route 
          path="home" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <HomePage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="auth" 
          element={
            <AuthRoute>
              <Suspense fallback={<PageLoader />}>
                <AuthPage />
              </Suspense>
            </AuthRoute>
          } 
        />
        
        <Route 
          path="onboarding" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <OnboardingPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="journal" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <JournalCapturePage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="insights" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <InsightsPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="settings" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="subscription" 
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}>
                <SubscriptionPage />
              </Suspense>
            </ProtectedRoute>
          } 
        />
      </Route>

      {/* Website routes (only for web, not native) */}
      {!isNative && (
        <>
          <Route 
            path="/" 
            element={
              <Suspense fallback={<PageLoader />}>
                <IndexPage />
              </Suspense>
            } 
          />
          <Route path="*" element={<Navigate to="/app/home" replace />} />
        </>
      )}

      {/* Fallback for native apps */}
      {isNative && (
        <Route path="*" element={<Navigate to="/app/home" replace />} />
      )}
    </Routes>
  );
}