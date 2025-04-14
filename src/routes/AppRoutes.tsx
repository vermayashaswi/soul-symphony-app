
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

const AppRoutes = () => {
  const { user } = useAuth();
  const onboardingComplete = user?.user_metadata?.onboarding_completed ?? null;

  return (
    <>
      <Routes>
        <Route path="/app/auth" element={<Auth />} />
        <Route path="/auth" element={<Auth />} />
        
        {/* Onboarding route - accessible without auth */}
        <Route path="/app/onboarding" element={<OnboardingScreen />} />
        
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
        
        {/* Root app routes - conditionally redirect based on auth status */}
        <Route 
          path="/app" 
          element={user ? <Navigate to="/app/home" replace /> : <Navigate to="/app/onboarding" replace />} 
        />
        <Route 
          path="/" 
          element={user ? <Navigate to="/app/home" replace /> : <Navigate to="/app/onboarding" replace />} 
        />
      </Routes>
      {user && <MobileNavigation onboardingComplete={onboardingComplete} />}
    </>
  );
};

export default AppRoutes;
