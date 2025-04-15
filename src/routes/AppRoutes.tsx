
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Journal from '@/pages/Journal';
import Auth from '@/pages/Auth';
import Home from '@/pages/Home';
import Insights from '@/pages/Insights';
import SmartChat from '@/pages/SmartChat';
import Settings from '@/pages/Settings';
import ProtectedRoute from './ProtectedRoute';
import MobileNavigation from './MobileNavigation';
import { useAuth } from '@/contexts/AuthContext';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';
import HomePage from '@/pages/website/HomePage';
import { isAppSubdomain } from './RouteHelpers';

const AppRoutes = () => {
  const { user } = useAuth();
  const onboardingComplete = user?.user_metadata?.onboarding_completed ?? null;
  const appSubdomain = window.location.hostname === 'app.soulo.online';

  // Force render marketing site on main domain
  if (!appSubdomain && window.location.pathname === '/') {
    console.log('Main domain - showing modern landing page (HomePage)');
    return <HomePage />;
  }

  return (
    <>
      <Routes>
        {/* Auth routes - adjust paths based on domain */}
        {appSubdomain ? (
          <Route path="/auth" element={<Auth />} />
        ) : (
          <>
            <Route path="/app/auth" element={<Auth />} />
            <Route path="/auth" element={<Auth />} />
          </>
        )}
        
        {/* Onboarding route - accessible without auth */}
        {appSubdomain ? (
          <Route path="/onboarding" element={<OnboardingScreen />} />
        ) : (
          <Route path="/app/onboarding" element={<OnboardingScreen />} />
        )}
        
        {/* Website routes - use the modern landing page */}
        {!appSubdomain && (
          <Route path="/" element={<HomePage />} />
        )}
        
        {/* App routes with domain-specific paths */}
        {isAppSubdomain() ? (
          <>
            <Route 
              path="/home" 
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/journal" 
              element={
                <ProtectedRoute>
                  <Journal />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/insights" 
              element={
                <ProtectedRoute>
                  <Insights />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/smart-chat" 
              element={
                <ProtectedRoute>
                  <SmartChat />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
          </>
        ) : (
          <>
            <Route 
              path="/app/home" 
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/app/journal" 
              element={
                <ProtectedRoute>
                  <Journal />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/app/insights" 
              element={
                <ProtectedRoute>
                  <Insights />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/app/smart-chat" 
              element={
                <ProtectedRoute>
                  <SmartChat />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/app/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
          </>
        )}
        
        {/* Root app routes - conditionally redirect based on auth status */}
        {appSubdomain ? (
          <Route 
            path="/" 
            element={user ? <Navigate to="/home" replace /> : <Navigate to="/onboarding" replace />} 
          />
        ) : (
          <Route 
            path="/app" 
            element={user ? <Navigate to="/app/home" replace /> : <Navigate to="/app/onboarding" replace />} 
          />
        )}
      </Routes>
      {user && <MobileNavigation onboardingComplete={onboardingComplete} />}
    </>
  );
};

export default AppRoutes;
