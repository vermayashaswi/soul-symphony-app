
import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/use-onboarding';
import MobilePreviewFrame from '@/components/MobilePreviewFrame';
import MobileNavbar from '@/components/mobile/MobileNavbar';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';
import ProtectedRoute from './ProtectedRoute';

// Pages
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import Journal from '@/pages/Journal';
import Insights from '@/pages/Insights';
import SmartChat from '@/pages/SmartChat';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/NotFound';
import Home from '@/pages/Home';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import AppDownload from '@/pages/AppDownload';

const ScrollToTop = () => {
  useScrollRestoration();
  return null;
};

const MobilePreviewWrapper = ({ children }: { children: React.ReactNode }) => {
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  return mobileDemo ? <MobilePreviewFrame>{children}</MobilePreviewFrame> : <>{children}</>;
};

const AppRoutes = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { onboardingComplete, loading: onboardingLoading } = useOnboarding();
  const location = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  const shouldShowMobileNav = isMobile || mobileDemo;
  
  const isAuthRoute = location.pathname === '/auth';
  const isOnboardingRoute = location.pathname === '/onboarding';
  const isOnboardingBypassedRoute = isAuthRoute || location.pathname.includes('debug') || location.pathname.includes('admin');
  
  // Check if this is a website route (public page that should always be accessible)
  const isWebsiteRoute = [
    '/privacy-policy',
    '/app-download',
    '/about',
    '/blog',
    '/contact',
    '/terms',
  ].includes(location.pathname);
  
  // Check if this is running in a native mobile app environment
  const isNativeApp = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('nativeApp') === 'true' || 
           window.location.href.includes('capacitor://') || 
           window.location.href.includes('localhost');
  };
  
  useEffect(() => {
    console.log("Setting up routes and checking authentication");
    const setCorrectViewport = () => {
      const metaViewport = document.querySelector('meta[name="viewport"]');
      const correctContent = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      
      if (metaViewport) {
        if (metaViewport.getAttribute('content') !== correctContent) {
          console.log("Updating existing viewport meta tag");
          metaViewport.setAttribute('content', correctContent);
        }
      } else {
        console.log("Creating new viewport meta tag");
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = correctContent;
        document.head.appendChild(meta);
      }
    };
    
    setCorrectViewport();
    setTimeout(setCorrectViewport, 100);
    
    console.log("Setting up Supabase auth debugging listener");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event outside React context:", event, session?.user?.email);
    });
    
    // Redirect to download page if accessing app routes from a browser (non-native)
    if (!isWebsiteRoute && !isNativeApp() && location.pathname !== '/') {
      console.log("Browser trying to access app route, redirecting to download page");
      window.location.href = '/app-download';
    }
    
    return () => {
      subscription.unsubscribe();
    };
  }, [location.pathname]);
  
  if (onboardingLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="animate-spin w-8 h-8 border-4 border-theme border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  const shouldShowOnboarding = 
    !user && 
    !onboardingComplete && 
    !isOnboardingBypassedRoute &&
    !isOnboardingRoute && 
    isNativeApp(); // Only show onboarding in native app
  
  if (shouldShowOnboarding) {
    return (
      <MobilePreviewWrapper>
        <OnboardingScreen />
      </MobilePreviewWrapper>
    );
  }
  
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={
          isNativeApp() ? (
            user ? <Navigate to="/home" replace /> : (
              shouldShowOnboarding ? (
                <Navigate to="/onboarding" replace />
              ) : (
                <MobilePreviewWrapper>
                  <Index />
                </MobilePreviewWrapper>
              )
            )
          ) : (
            // Website visitors see the landing page
            <MobilePreviewWrapper>
              <Index />
            </MobilePreviewWrapper>
          )
        } />
        
        {/* Public website routes */}
        <Route path="/privacy-policy" element={
          <MobilePreviewWrapper>
            <PrivacyPolicy />
          </MobilePreviewWrapper>
        } />
        
        <Route path="/app-download" element={
          <MobilePreviewWrapper>
            <AppDownload />
          </MobilePreviewWrapper>
        } />
        
        {/* App-only routes - redirect to download page if not in native app */}
        <Route path="/auth" element={
          isNativeApp() ? (
            user ? <Navigate to="/home" replace /> : (
              <MobilePreviewWrapper>
                <Auth />
              </MobilePreviewWrapper>
            )
          ) : (
            <Navigate to="/app-download" replace />
          )
        } />
        
        <Route path="/home" element={
          isNativeApp() ? (
            <MobilePreviewWrapper>
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            </MobilePreviewWrapper>
          ) : (
            <Navigate to="/app-download" replace />
          )
        } />
        
        <Route path="/journal" element={
          isNativeApp() ? (
            <MobilePreviewWrapper>
              <ProtectedRoute>
                <Journal />
              </ProtectedRoute>
            </MobilePreviewWrapper>
          ) : (
            <Navigate to="/app-download" replace />
          )
        } />
        
        <Route path="/insights" element={
          isNativeApp() ? (
            <MobilePreviewWrapper>
              <ProtectedRoute>
                <Insights />
              </ProtectedRoute>
            </MobilePreviewWrapper>
          ) : (
            <Navigate to="/app-download" replace />
          )
        } />
        
        <Route path="/chat" element={
          <Navigate to="/smart-chat" replace />
        } />
        
        <Route path="/smart-chat" element={
          isNativeApp() ? (
            <MobilePreviewWrapper>
              <ProtectedRoute>
                <SmartChat />
              </ProtectedRoute>
            </MobilePreviewWrapper>
          ) : (
            <Navigate to="/app-download" replace />
          )
        } />
        
        <Route path="/settings" element={
          isNativeApp() ? (
            <MobilePreviewWrapper>
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            </MobilePreviewWrapper>
          ) : (
            <Navigate to="/app-download" replace />
          )
        } />
        
        <Route path="/onboarding" element={
          isNativeApp() ? (
            user ? <Navigate to="/home" replace /> : (
              <MobilePreviewWrapper>
                <OnboardingScreen />
              </MobilePreviewWrapper>
            )
          ) : (
            <Navigate to="/app-download" replace />
          )
        } />
        
        <Route path="*" element={
          <MobilePreviewWrapper>
            <NotFound />
          </MobilePreviewWrapper>
        } />
      </Routes>

      {shouldShowMobileNav && !shouldShowOnboarding && !isOnboardingRoute && isNativeApp() && <MobileNavbar />}
    </>
  );
};

export default AppRoutes;
