
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/hooks/use-theme';
import { OnboardingProvider } from '@/hooks/use-onboarding';
import { isNativeApp } from './RouteHelpers';
import ViewportManager from './ViewportManager';
import ProtectedRoute from './ProtectedRoute';
import OnboardingCheck from './OnboardingCheck';
import Home from '@/pages/Home';
import Index from '@/pages/Index';
import AppDownload from '@/pages/AppDownload';
import Auth from '@/pages/Auth';
import Settings from '@/pages/Settings';
import Journal from '@/pages/Journal';
import Insights from '@/pages/Insights';
import Chat from '@/pages/Chat';
import SmartChat from '@/pages/SmartChat';
import NotFound from '@/pages/NotFound';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import HomePage from '@/pages/website/HomePage';
import BlogPage from '@/pages/website/BlogPage';
import BlogPostPage from '@/pages/website/BlogPostPage';
import FAQPage from '@/pages/website/FAQPage';
import PrivacyPolicyPage from '@/pages/legal/PrivacyPolicyPage';

const AppRoutes: React.FC = () => {
  return (
    <Router>
      <ThemeProvider>
        <OnboardingProvider>
          <Routes>
            <Route element={<ViewportManager />}>
              {/* Website routes */}
              <Route path="/" element={<Index />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/blog/:slug" element={<BlogPostPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/download" element={<AppDownload />} />

              {/* App routes */}
              <Route path="/app" element={<ProtectedRoute />}>
                <Route element={<OnboardingCheck />}>
                  <Route index element={<Navigate to="/app/home" replace />} />
                  <Route path="home" element={<Home />} />
                  <Route path="journal" element={<Journal />} />
                  <Route path="insights" element={<Insights />} />
                  <Route path="chat" element={<Chat />} />
                  <Route path="smart-chat" element={<SmartChat />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Route>

              {/* Auth routes */}
              <Route path="/login" element={<Auth />} />
              <Route path="/signup" element={<Auth />} />

              {/* Native app specific routes */}
              {isNativeApp() && (
                <Route path="/privacy" element={<PrivacyPolicy />} />
              )}

              {/* 404 route */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </OnboardingProvider>
      </ThemeProvider>
    </Router>
  );
};

export default AppRoutes;
