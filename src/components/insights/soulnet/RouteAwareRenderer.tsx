
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteAwareRendererProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RouteAwareRenderer: React.FC<RouteAwareRendererProps> = ({ 
  children, 
  fallback = null 
}) => {
  const [isRouteReady, setIsRouteReady] = useState(false);
  const [renderingStage, setRenderingStage] = useState<'initial' | 'ready'>('initial');
  const location = useLocation();

  useEffect(() => {
    console.log('[RouteAwareRenderer] Route changed:', location.pathname);
    
    // Reset rendering state on route change
    setIsRouteReady(false);
    setRenderingStage('initial');

    // Progressive rendering initialization
    const timer = setTimeout(() => {
      setIsRouteReady(true);
      setRenderingStage('ready');
      console.log('[RouteAwareRenderer] Route rendering ready');
    }, 50);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (!isRouteReady || renderingStage === 'initial') {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default RouteAwareRenderer;
