
import React from 'react';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import Journal from '@/pages/Journal';
import Insights from '@/pages/Insights';
import SmartChat from '@/pages/SmartChat';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/NotFound';
import Home from '@/pages/Home';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import AppDownload from '@/pages/AppDownload';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';
import FAQPage from '@/pages/website/FAQPage';
import BlogPage from '@/pages/website/BlogPage';
import BlogPostPage from '@/pages/website/BlogPostPage';
import HomePage from '@/pages/website/HomePage';
import PrivacyPolicyPage from '@/pages/legal/PrivacyPolicyPage';
import AppDownloadPage from '@/pages/AppDownloadPage';

export type RouteConfig = {
  path: string;
  element: React.ReactNode;
  requiresAuth?: boolean;
  isWebsiteRoute?: boolean;
  redirectPath?: string;
};

// Website public routes (always accessible)
export const websiteRoutes: RouteConfig[] = [
  {
    path: '/',
    element: <HomePage />,
    isWebsiteRoute: true,
  },
  {
    path: '/blog',
    element: <BlogPage />,
    isWebsiteRoute: true,
  },
  {
    path: '/blog/:slug',
    element: <BlogPostPage />,
    isWebsiteRoute: true,
  },
  {
    path: '/faq',
    element: <FAQPage />,
    isWebsiteRoute: true,
  },
  {
    path: '/privacy-policy',
    element: <PrivacyPolicyPage />,
    isWebsiteRoute: true,
  },
  {
    path: '/app-download',
    element: <AppDownloadPage />,
    isWebsiteRoute: true,
  },
  // Legacy routes from before website update
  {
    path: '/privacy-policy-old',
    element: <PrivacyPolicy />,
    isWebsiteRoute: true,
  },
  {
    path: '/app-download-old',
    element: <AppDownload />,
    isWebsiteRoute: true,
  },
];

// App routes (protected in browser, accessible in native app)
export const appRoutes: RouteConfig[] = [
  {
    path: '/auth',
    element: <Auth />,
  },
  {
    path: '/home',
    element: <Home />,
    requiresAuth: true,
  },
  {
    path: '/journal',
    element: <Journal />,
    requiresAuth: true,
  },
  {
    path: '/insights',
    element: <Insights />,
    requiresAuth: true,
  },
  {
    path: '/smart-chat',
    element: <SmartChat />,
    requiresAuth: true,
  },
  {
    path: '/settings',
    element: <Settings />,
    requiresAuth: true,
  },
  {
    path: '/onboarding',
    element: <OnboardingScreen />,
  },
  {
    path: '/chat',
    element: null,
    redirectPath: '/smart-chat',
  },
];

// Special routes
export const specialRoutes: RouteConfig[] = [
  {
    path: '*',
    element: <NotFound />,
  },
];
