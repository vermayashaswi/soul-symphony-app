
import React from 'react';
import HomePage from '@/pages/website/HomePage';

const Index = () => {
  console.log('[Index] Rendering homepage');
  
  // Simple render without complex auth checks or redirects
  // The website should be accessible without authentication
  return <HomePage />;
};

export default Index;
