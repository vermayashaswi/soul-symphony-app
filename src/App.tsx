
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './hooks/use-theme';
import { TranslationProvider } from './contexts/TranslationContext';
import { useOnboarding } from './hooks/use-onboarding';

// Marketing pages
import Index from './pages/Index';
import FAQPage from './pages/website/FAQPage';
import BlogPage from './pages/website/BlogPage';
import BlogPostPage from './pages/website/BlogPostPage';
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage';
import NotFound from './pages/NotFound';

// App pages
import Home from './pages/Home';
import Auth from './pages/Auth';
import Journal from './pages/Journal';
import Chat from './pages/Chat';
import SmartChat from './pages/SmartChat';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
import ThemesManagement from './pages/ThemesManagement';
import ProtectedRoute from './routes/ProtectedRoute';
import OnboardingCheck from './routes/OnboardingCheck';
import ViewportManager from './routes/ViewportManager';

// UI components for app layout
import { Toaster } from './components/ui/sonner';
import { Toaster as ShadcnToaster } from './components/ui/toaster';
import Navbar from './components/Navbar';
import MobileNavigation from './components/MobileNavigation';
import { User } from '@supabase/supabase-js';

// --- Pure Marketing Routes ---
const MarketingRoutes = () => (
  <div className="min-h-screen bg-background text-foreground">
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<PrivacyPolicyPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </div>
);

// --- All /app pages with providers and app layout ---
const AppRoutesWithAuth = () => {
  const { user } = useAuth();
  const { onboardingComplete, loading: onboardingLoading } = useOnboarding();

  // FIX: Only put <Routes/>, <Navbar/>, etc. inside the ViewportManager so they render using React Router's Outlet system correctly. Do NOT pass children directly to ViewportManager.
  return (
    <>
      <Navbar />
      <ViewportManager />
      <MobileNavigation onboardingComplete={onboardingComplete} />
      <Toaster />
      <ShadcnToaster />
    </>
  );
};

const AppRoutes = () => (
  <ThemeProvider>
    <TranslationProvider>
      <AuthProvider>
        <Routes>
          {/* All /app routes wrapped in ViewportManager */}
          <Route
            path="/app/*"
            element={<AppRoutesWithAuth />}
          >
            <Route path="auth" element={<Auth />} />
            <Route element={<ProtectedRoute />}>
              <Route
                index
                element={
                  <OnboardingCheck
                    onboardingComplete={useOnboarding().onboardingComplete}
                    onboardingLoading={useOnboarding().loading}
                    user={useAuth().user as User | null}
                  >
                    <Home />
                  </OnboardingCheck>
                }
              />
              <Route path="journal" element={<Journal />} />
              <Route path="chat" element={<Chat />} />
              <Route path="smart-chat" element={<SmartChat />} />
              <Route path="insights" element={<Insights />} />
              <Route path="settings" element={<Settings />} />
              <Route path="themes" element={<ThemesManagement />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </TranslationProvider>
  </ThemeProvider>
);

// --- Main Switch between /app and marketing ---
const App = () => {
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith('/app');
  return isAppRoute ? <AppRoutes /> : <MarketingRoutes />;
};

export default App;
