
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './hooks/use-theme';
import { MarketingThemeProvider } from './contexts/MarketingThemeProvider';
import { MarketingErrorBoundary } from './components/marketing/MarketingErrorBoundary';
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

// Error Boundary Component for App Routes
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[App] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-4">Please refresh the page to try again.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-primary text-primary-foreground rounded"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Pure Marketing Routes ---
const MarketingRoutes = () => (
  <MarketingErrorBoundary>
    <MarketingThemeProvider>
      <div className="min-h-screen bg-white text-gray-900">
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
    </MarketingThemeProvider>
  </MarketingErrorBoundary>
);

// --- App Routes with Mobile Navigation ---
const AppRoutesWithNavigation = () => {
  const { onboardingComplete } = useOnboarding();

  return (
    <>
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
    </>
  );
};

// --- App Routes Component ---
const AppRoutesComponent = () => {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <TranslationProvider>
          <AuthProvider>
            <TutorialProvider>
              <ViewportManager>
                <AppRoutesWithNavigation />
              </ViewportManager>
              <Toaster />
              <ShadcnToaster />
            </TutorialProvider>
          </AuthProvider>
        </TranslationProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
};

// --- Main App Component ---
const App = () => {
  const location = useLocation();
  const isOnAppRoute = isAppRoute(location.pathname);
  
  console.log('[App] Current route:', location.pathname, 'isAppRoute:', isOnAppRoute);
  
  return (
    <>
      {isOnAppRoute ? <AppRoutesComponent /> : <MarketingRoutes />}
    </>
  );
};

export default App;
