
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import MobilePreviewFrame from '@/components/MobilePreviewFrame';
import MobileNavbar from '@/components/mobile/MobileNavbar';
import ProtectedRoute from './ProtectedRoute';

// Pages
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import Journal from '@/pages/Journal';
import Insights from '@/pages/Insights';
import SmartChat from '@/pages/SmartChat';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/NotFound';

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
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  const shouldShowMobileNav = isMobile || mobileDemo;

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
  
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={
          <MobilePreviewWrapper>
            <Index />
          </MobilePreviewWrapper>
        } />
        <Route path="/auth" element={
          <MobilePreviewWrapper>
            <Auth />
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
        <Route path="*" element={
          <MobilePreviewWrapper>
            <NotFound />
          </MobilePreviewWrapper>
        } />
      </Routes>

      {shouldShowMobileNav && <MobileNavbar />}
    </>
  );
};

export default AppRoutes;
