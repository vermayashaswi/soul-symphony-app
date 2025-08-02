
import React from 'react';
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
import AccountDeletion from '@/pages/AccountDeletion';
import DataDeletion from '@/pages/DataDeletion';

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
  {
    path: '/account-deletion',
    element: <AccountDeletion />,
    isWebsiteRoute: true,
  },
  {
    path: '/data-deletion',
    element: <DataDeletion />,
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
    path: '/app',
    element: <OnboardingScreen />,
    requiresAuth: false, // Important: This should not require auth
  },
  {
    path: '/app/onboarding',
    element: <OnboardingScreen />,
    requiresAuth: false, // Important: This should not require auth
  },
  {
    path: '/app/auth',
    element: <Auth />,
    requiresAuth: false, // Important: This should not require auth
  },
  {
    path: '/app/home',
    element: <Home />,
    requiresAuth: true,
  },
  {
    path: '/app/journal',
    element: <Journal />,
    requiresAuth: true,
  },
  {
    path: '/app/insights',
    element: <Insights />,
    requiresAuth: true,
  },
  {
    path: '/app/smart-chat',
    element: <SmartChat />,
    requiresAuth: true,
  },
  {
    path: '/app/settings',
    element: <Settings />,
    requiresAuth: true,
  },
  // Legacy redirects
  {
    path: '/auth',
    element: null,
    redirectPath: '/app/auth',
  },
  {
    path: '/home',
    element: null,
    redirectPath: '/app/home',
  },
  {
    path: '/journal',
    element: null,
    redirectPath: '/app/journal',
  },
  {
    path: '/insights',
    element: null,
    redirectPath: '/app/insights',
  },
  {
    path: '/smart-chat',
    element: null,
    redirectPath: '/app/smart-chat',
  },
  {
    path: '/settings',
    element: null,
    redirectPath: '/app/settings',
  },
  {
    path: '/onboarding',
    element: null,
    redirectPath: '/app/onboarding',
  },
  {
    path: '/chat',
    element: null,
    redirectPath: '/app/smart-chat',
  },
];

// Special routes
export const specialRoutes: RouteConfig[] = [
  {
    path: '*',
    element: <NotFound />,
  },
];
