
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './hooks/use-theme';
import { TranslationProvider } from './contexts/TranslationContext';
import { TutorialProvider } from './contexts/TutorialContext';

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
import OnboardingScreen from './components/onboarding/OnboardingScreen';
import ProtectedRoute from './routes/ProtectedRoute';
import OnboardingCheck from './routes/OnboardingCheck';
import ViewportManager from './routes/ViewportManager';

// UI components for app layout
import { Toaster } from './components/ui/sonner';
import { Toaster as ShadcnToaster } from './components/ui/toaster';
import Navbar from './components/Navbar';
import MobileNavigation from './components/MobileNavigation';
import TutorialOverlay from './components/tutorial/TutorialOverlay';

// Import onboarding hook
import { useOnboarding } from './hooks/use-onboarding';

// Helper function to check if route is app route
const isAppRoute = (pathname: string) => pathname.startsWith('/app');

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

// --- App Routes Component ---
const AppRoutesComponent = () => {
  const { onboardingComplete } = useOnboarding();

  return (
    <ThemeProvider>
      <TranslationProvider>
        <AuthProvider>
          <TutorialProvider>
            <ViewportManager>
              <Navbar />
              <Routes>
                <Route path="/app/onboarding" element={<OnboardingScreen />} />
                <Route path="/app/auth" element={<Auth />} />
                <Route element={<ProtectedRoute />}>
                  <Route 
                    path="/app" 
                    element={
                      <OnboardingCheck>
                        <Home />
                      </OnboardingCheck>
                    } 
                  />
                  <Route path="/app/home" element={<Home />} />
                  <Route path="/app/journal" element={<Journal />} />
                  <Route path="/app/chat" element={<Chat />} />
                  <Route path="/app/smart-chat" element={<SmartChat />} />
                  <Route path="/app/insights" element={<Insights />} />
                  <Route path="/app/settings" element={<Settings />} />
                  <Route path="/app/themes" element={<ThemesManagement />} />
                </Route>
              </Routes>
              <MobileNavigation onboardingComplete={onboardingComplete} />
              <TutorialOverlay />
            </ViewportManager>
            <Toaster />
            <ShadcnToaster />
          </TutorialProvider>
        </AuthProvider>
      </TranslationProvider>
    </ThemeProvider>
  );
};

// --- Main App Component ---
const App = () => {
  const location = useLocation();
  const isOnAppRoute = isAppRoute(location.pathname);
  
  return isOnAppRoute ? <AppRoutesComponent /> : <MarketingRoutes />;
};

export default App;
