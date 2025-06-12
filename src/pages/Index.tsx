
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import HomePage from '@/pages/website/HomePage';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const isMobile = useIsMobile();
  const [hasRedirected, setHasRedirected] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  console.log('Index: Rendering marketing homepage at:', window.location.pathname);
  console.log('Index: URL params:', Object.fromEntries(urlParams.entries()));

  // Handle explicit redirects only, with safety checks
  useEffect(() => {
    if (hasRedirected) return; // Prevent multiple redirects
    
    // Only redirect if explicitly requested via URL parameters
    if (urlParams.has('app') && user) {
      console.log('Index: Explicit app redirect requested');
      setHasRedirected(true);
      navigate('/app/home', { replace: true });
    } else if (urlParams.has('insights') && user) {
      console.log('Index: Insights redirect requested');
      setHasRedirected(true);
      navigate('/app/insights', { replace: true });
    }
  }, [user, navigate, urlParams, hasRedirected]);

  // Simple render without complex network checks that might cause issues
  return <HomePage />;
};

export default Index;
