
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
  const isHomePage = location.pathname === '/';

  useEffect(() => {
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
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // If onboarding is still loading, show a loading spinner
  if (onboardingLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <div className="animate-spin w-8 h-8 border-4 border-theme border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  // Show onboarding only for new users who haven't completed it and aren't accessing special routes
  // Also make sure we're on the home page to avoid showing onboarding after sign out
  const shouldShowOnboarding = 
    (isMobile || mobileDemo) && 
    !user && 
    !onboardingComplete && 
    !isOnboardingBypassedRoute &&
    !isOnboardingRoute &&
    isHomePage; // Only show onboarding on the home page
  
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
          user ? <Navigate to="/home" replace /> : (
            <MobilePreviewWrapper>
              <Index />
            </MobilePreviewWrapper>
          )
        } />
        <Route path="/auth" element={
          <MobilePreviewWrapper>
            <Auth />
          </MobilePreviewWrapper>
        } />
        <Route path="/home" element={
          <MobilePreviewWrapper>
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          </MobilePreviewWrapper>
        } />
        <Route path="/journal" element={
          <MobilePreviewWrapper>
            <ProtectedRoute>
              <Journal />
            </ProtectedRoute>
          </MobilePreviewWrapper>
        } />
        <Route path="/insights" element={
          <MobilePreviewWrapper>
            <ProtectedRoute>
              <Insights />
            </ProtectedRoute>
          </MobilePreviewWrapper>
        } />
        <Route path="/chat" element={
          <Navigate to="/smart-chat" replace />
        } />
        <Route path="/smart-chat" element={
          <MobilePreviewWrapper>
            <ProtectedRoute>
              <SmartChat />
            </ProtectedRoute>
          </MobilePreviewWrapper>
        } />
        <Route path="/settings" element={
          <MobilePreviewWrapper>
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          </MobilePreviewWrapper>
        } />
        <Route path="/onboarding" element={
          <MobilePreviewWrapper>
            <OnboardingScreen />
          </MobilePreviewWrapper>
        } />
        <Route path="*" element={
          <MobilePreviewWrapper>
            <NotFound />
          </MobilePreviewWrapper>
        } />
      </Routes>

      {shouldShowMobileNav && !shouldShowOnboarding && !isOnboardingRoute && <MobileNavbar />}
    </>
  );
};

export default AppRoutes;
