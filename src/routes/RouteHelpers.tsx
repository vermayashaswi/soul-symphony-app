
import React, { useEffect } from 'react';
import { Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar'; // Import the Navbar component

export const isNativeApp = (): boolean => {
  return /native/i.test(window.navigator.userAgent);
};

export const isAppRoute = (pathname: string): boolean => {
  return pathname.startsWith('/app');
};

export const WebsiteRouteWrapper = ({ element }: { element: React.ReactNode }) => {
  return (
    <div className="website-route">
      {element}
    </div>
  );
};

// This is the update to the AppRouteWrapper component
export const AppRouteWrapper = ({ 
  element, 
  requiresAuth = true,
  hideNavbar = false 
}: { 
  element: React.ReactNode, 
  requiresAuth?: boolean,
  hideNavbar?: boolean 
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (requiresAuth && !user) {
      navigate('/auth');
    }
  }, [user, navigate, requiresAuth]);

  return (
    <div className="min-h-screen app-route">
      {!hideNavbar && <Navbar />}
      <div className="pt-16 min-h-screen">
        {element}
      </div>
    </div>
  );
};

export const RedirectRoute = ({ to }: { to: string }) => {
  return <Navigate to={to} replace />;
};
