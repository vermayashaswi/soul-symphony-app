
// Route helper functions for determining route types and handling navigation

export const isWebsiteRoute = (pathname: string): boolean => {
  console.log(`isAppRoute check for ${pathname}: ${pathname.startsWith('/app')}`);
  
  // Root path is treated as website route
  if (pathname === '/') {
    console.log(`${pathname} is root, treating as website route`);
    return true;
  }
  
  // App routes start with /app
  const isApp = pathname.startsWith('/app');
  
  // Website routes include specific paths
  const websiteRoutes = [
    '/blog',
    '/faq', 
    '/privacy',
    '/terms',
    '/contact'
  ];
  
  const isWebsite = websiteRoutes.some(route => pathname.startsWith(route)) || pathname === '/';
  
  console.log(`Route ${pathname} - isApp: ${isApp}, isWebsite: ${isWebsite}`);
  
  return isWebsite && !isApp;
};

export const isAppRoute = (pathname: string): boolean => {
  return pathname.startsWith('/app');
};

export const getRouteType = (pathname: string): 'website' | 'app' => {
  return isAppRoute(pathname) ? 'app' : 'website';
};
