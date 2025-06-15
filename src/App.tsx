
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
          <Route path="/app" element={
            <ProtectedRoute>
              <OnboardingCheck
                onboardingComplete={onboardingComplete}
                onboardingLoading={onboardingLoading}
                user={user}
              >
                <Home />
              </OnboardingCheck>
            </ProtectedRoute>
          } />
          <Route path="/app/journal" element={
            <ProtectedRoute>
              <Journal />
            </ProtectedRoute>
          } />
          <Route path="/app/chat" element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } />
          <Route path="/app/smart-chat" element={
            <ProtectedRoute>
              <SmartChat />
            </ProtectedRoute>
          } />
          <Route path="/app/insights" element={
            <ProtectedRoute>
              <Insights />
            </ProtectedRoute>
          } />
          <Route path="/app/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/app/themes" element={
            <ProtectedRoute>
              <ThemesManagement />
            </ProtectedRoute>
          } />
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
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<PrivacyPolicyPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Main App Component
const App = () => {
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith('/app');

  return isAppRoute ? <AppRoutes /> : <MarketingRoutes />;
};

export default App;
