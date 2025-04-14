
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MobileNavigation from './MobileNavigation';
import { useAuth } from '@/contexts/AuthContext';
import { appRoutes, websiteRoutes, specialRoutes } from './routeConfig';
import ProtectedRoute from './ProtectedRoute';

const AppRoutes = () => {
  const { user } = useAuth();
  const onboardingComplete = user?.user_metadata?.onboarding_completed ?? null;

  return (
    <>
      <Routes>
        {/* Render app routes from configuration */}
        {appRoutes.map((route) => {
          // Handle redirects
          if (route.redirectPath) {
            return (
              <Route 
                key={route.path} 
                path={route.path} 
                element={<Navigate to={route.redirectPath} replace />} 
              />
            );
          }
          
          // Handle protected routes
          if (route.requiresAuth) {
            return (
              <Route 
                key={route.path} 
                path={route.path} 
                element={
                  <ProtectedRoute>
                    {route.element}
                  </ProtectedRoute>
                } 
              />
            );
          }
          
          // Handle regular routes
          return (
            <Route 
              key={route.path} 
              path={route.path} 
              element={route.element} 
            />
          );
        })}
        
        {/* Render website routes from configuration */}
        {websiteRoutes.map((route) => (
          <Route 
            key={route.path} 
            path={route.path} 
            element={route.element} 
          />
        ))}
        
        {/* Render special routes from configuration */}
        {specialRoutes.map((route) => (
          <Route 
            key={route.path} 
            path={route.path} 
            element={route.element} 
          />
        ))}
        
        {/* Default routes */}
        <Route path="/" element={<Navigate to="/app" replace />} />
      </Routes>
      {user && <MobileNavigation onboardingComplete={onboardingComplete} />}
    </>
  );
};

export default AppRoutes;
