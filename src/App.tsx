
import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { appRoutes, websiteRoutes, specialRoutes } from '@/routes/routeConfig';
import './App.css';
import './styles/mobile.css';
import './styles/emoji.css';
import './styles/tutorial.css';

// Create the router from our route configuration
const router = createBrowserRouter([...websiteRoutes, ...appRoutes, ...specialRoutes].map(route => {
  if (route.redirectPath) {
    return {
      path: route.path,
      element: <React.Fragment key={route.path}>{route.element}</React.Fragment>,
      loader: () => {
        return { redirectTo: route.redirectPath };
      }
    };
  }
  return {
    path: route.path,
    element: <React.Fragment key={route.path}>{route.element}</React.Fragment>
  };
}));

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}

export default App;
