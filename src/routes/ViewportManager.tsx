
import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

const ViewportManager: React.FC = () => {
  useEffect(() => {
    // Set viewport meta tag for better mobile compatibility
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    
    if (viewportMeta) {
      console.log('Updating existing viewport meta tag');
      viewportMeta.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    } else {
      console.log('Creating new viewport meta tag');
      const newViewportMeta = document.createElement('meta');
      newViewportMeta.name = 'viewport';
      newViewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      document.head.appendChild(newViewportMeta);
    }
  }, []);

  // Use Outlet to render child routes
  return <Outlet />;
};

export default ViewportManager;
