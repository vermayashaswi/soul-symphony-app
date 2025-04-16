
import React from 'react';
import Home from '@/pages/Home';

export type RouteConfig = {
  path: string;
  element: React.ReactNode;
};

export const routes: RouteConfig[] = [
  {
    path: '/',
    element: <Home />,
  },
];
