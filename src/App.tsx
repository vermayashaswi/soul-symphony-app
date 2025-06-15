import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './hooks/use-theme';
import { TranslationProvider } from './contexts/TranslationContext';
import { useOnboarding } from './hooks/use-onboarding';
import { User } from '@supabase/supabase-js';

// Marketing pages
import Index from './pages/Index';
import FAQPage from './pages/website/FAQPage';
import BlogPage from './pages/website/BlogPage';
import BlogPostPage from './pages/website/BlogPostPage';
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage';

// App pages  
import Home from './pages/Home';
import Auth from './pages/Auth';
import Journal from './pages/Journal';
import Chat from './pages/Chat';
import SmartChat from './pages/SmartChat';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
import ThemesManagement from './pages/ThemesManagement';
import NotFound from './pages/NotFound';

// Route components
import ProtectedRoute from './routes/ProtectedRoute';
import OnboardingCheck from './routes/OnboardingCheck';
import ViewportManager from './routes/ViewportManager';

// UI components
import { Toaster } from './components/ui/sonner';
import { Toaster as ShadcnToaster } from './components/ui/toaster';
import Navbar from './components/Navbar';
import MobileNavigation from './components/MobileNavigation';

// Inner App Component with access to Auth context
const AppRoutesWithAuth = () => {
  const { user } = useAuth();
  const { onboardingComplete, loading: onboardingLoading } = useOnboarding();

  return (
    <ViewportManager>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <Routes>
          <Route path="/app/auth" element={<Auth />} />
          <Route path="/app/*" element={<ProtectedRoute />}>
            <Route index element={
              <OnboardingCheck
                onboardingComplete={onboardingComplete}
                onboardingLoading={onboardingLoading}
                user={user as User | null}
              >
                <Home />
              </OnboardingCheck>
            } />
            <Route path="journal" element={<Journal />} />
            <Route path="chat" element={<Chat />} />
            <Route path="smart-chat" element={<SmartChat />} />
            <Route path="insights" element={<Insights />} />
            <Route path="settings" element={<Settings />} />
            <Route path="themes" element={<ThemesManagement />} />
          </Route>
        </Routes>
        <MobileNavigation onboardingComplete={onboardingComplete} />
        <Toaster />
        <ShadcnToaster />
      </div>
    </ViewportManager>
  );
};

// App Routes Component (wrapped with all providers)
const AppRoutes = () => {
  return (
    <ThemeProvider>
      <TranslationProvider>
        <AuthProvider>
          <AppRoutesWithAuth />
        </AuthProvider>
      </TranslationProvider>
    </ThemeProvider>
  );
};

// Marketing Routes Component (no providers needed)
const MarketingRoutes = () => {
  return (
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
};

// Main App Component
const App = () => {
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith('/app');

  return isAppRoute ? <AppRoutes /> : <MarketingRoutes />;
};

export default App;
