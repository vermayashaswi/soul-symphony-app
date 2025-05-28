
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import OnboardingCheck from './OnboardingCheck';
import ViewportManager from './ViewportManager';

// Import pages
import Home from '@/pages/Home';
import Journal from '@/pages/Journal';
import ProtectedInsights from '@/pages/ProtectedInsights';
import ProtectedChat from '@/pages/ProtectedChat';
import SmartChat from '@/pages/SmartChat';
import Settings from '@/pages/Settings';
import Auth from '@/pages/Auth';
import NotFound from '@/pages/NotFound';

const AppRoutes: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ViewportManager>
      <Routes>
        {/* Public routes */}
        <Route path="/app/onboarding" element={<Auth />} />
        
        {/* Protected routes */}
        <Route path="/app/*" element={
          <ProtectedRoute>
            <OnboardingCheck>
              <Routes>
                <Route path="home" element={<Home />} />
                <Route path="journal" element={<Journal />} />
                <Route path="insights" element={<ProtectedInsights />} />
                <Route path="chat" element={<ProtectedChat />} />
                <Route path="smart-chat" element={<SmartChat />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/app/home" replace />} />
              </Routes>
            </OnboardingCheck>
          </ProtectedRoute>
        } />
        
        {/* Fallback routes */}
        <Route path="/" element={
          user ? <Navigate to="/app/home" replace /> : <Navigate to="/app/onboarding" replace />
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ViewportManager>
  );
};

export default AppRoutes;
