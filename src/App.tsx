
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { LocationProvider } from './contexts/LocationContext';
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
    console.error('[AppErrorBoundary] Error caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      console.error('[AppErrorBoundary] Rendering error fallback');
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-4">Please refresh the page to try again.</p>
            <p className="text-sm text-red-600 mb-4">Error: {this.state.error?.message}</p>
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

// Context Provider Error Boundary for specific provider failures
class ProviderErrorBoundary extends React.Component<
  { children: React.ReactNode; providerName: string },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; providerName: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('[ProviderErrorBoundary] Provider error caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ProviderErrorBoundary] ${this.props.providerName} provider error:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      console.error(`[ProviderErrorBoundary] Rendering ${this.props.providerName} provider fallback`);
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Provider Error</h1>
            <p className="text-muted-foreground mb-4">
              {this.props.providerName} failed to initialize
            </p>
            <p className="text-sm text-red-600 mb-4">Error: {this.state.error?.message}</p>
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

// --- App Routes with Mobile Navigation ---
const AppRoutesWithNavigation = () => {
  console.log('[AppRoutesWithNavigation] Component mounting...');
  
  try {
    const { onboardingComplete } = useOnboarding();
    console.log('[AppRoutesWithNavigation] Onboarding status:', onboardingComplete);

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
            <Route 
              path="/app/home" 
              element={
                <OnboardingCheck>
                  <Home />
                </OnboardingCheck>
              } 
            />
            <Route 
              path="/app/journal" 
              element={
                <OnboardingCheck>
                  <Journal />
                </OnboardingCheck>
              } 
            />
            <Route 
              path="/app/chat" 
              element={
                <OnboardingCheck>
                  <Chat />
                </OnboardingCheck>
              } 
            />
            <Route 
              path="/app/smart-chat" 
              element={
                <OnboardingCheck>
                  <SmartChat />
                </OnboardingCheck>
              } 
            />
            <Route 
              path="/app/insights" 
              element={
                <OnboardingCheck>
                  <Insights />
                </OnboardingCheck>
              } 
            />
            <Route 
              path="/app/settings" 
              element={
                <OnboardingCheck>
                  <Settings />
                </OnboardingCheck>
              } 
            />
            <Route 
              path="/app/themes" 
              element={
                <OnboardingCheck>
                  <ThemesManagement />
                </OnboardingCheck>
              } 
            />
          </Route>
        </Routes>
        <MobileNavigation onboardingComplete={onboardingComplete} />
        <TutorialOverlay />
      </>
    );
  } catch (error) {
    console.error('[AppRoutesWithNavigation] Error in component:', error);
    throw error;
  }
};

// Enhanced context wrapper with proper provider order and error boundaries
const DebugContextWrapper = ({ children }: { children: React.ReactNode }) => {
  console.log('[DebugContextWrapper] Starting context provider chain...');
  
  return (
    <AppErrorBoundary>
      <ProviderErrorBoundary providerName="Theme">
        <ThemeProvider>
          <ProviderErrorBoundary providerName="Translation">
            <TranslationProvider>
              <ProviderErrorBoundary providerName="Auth">
                <AuthProvider>
                  <ProviderErrorBoundary providerName="Location">
                    <LocationProvider>
                      <ProviderErrorBoundary providerName="Subscription">
                        <SubscriptionProvider>
                          <ProviderErrorBoundary providerName="Tutorial">
                            <TutorialProvider>
                              <ViewportManager>
                                {children}
                              </ViewportManager>
                              <Toaster />
                              <ShadcnToaster />
                            </TutorialProvider>
                          </ProviderErrorBoundary>
                        </SubscriptionProvider>
                      </ProviderErrorBoundary>
                    </LocationProvider>
                  </ProviderErrorBoundary>
                </AuthProvider>
              </ProviderErrorBoundary>
            </TranslationProvider>
          </ProviderErrorBoundary>
        </ThemeProvider>
      </ProviderErrorBoundary>
    </AppErrorBoundary>
  );
};

// --- Main App Component ---
const App = () => {
  const location = useLocation();
  const isOnAppRoute = isAppRoute(location.pathname);
  
  console.log('[App] Current route:', location.pathname, 'isAppRoute:', isOnAppRoute);
  console.log('[App] Window location:', window.location.href);
  console.log('[App] User agent:', navigator.userAgent);
  
  // Render app routes with full context providers
  if (isOnAppRoute) {
    console.log('[App] Rendering app routes with full context providers');
    
    try {
      return (
        <DebugContextWrapper>
          <AppRoutesWithNavigation />
        </DebugContextWrapper>
      );
    } catch (error) {
      console.error('[App] Error rendering app routes:', error);
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4 text-red-600">App Loading Error</h1>
            <p className="text-gray-600 mb-4">Failed to load app components</p>
            <p className="text-sm text-red-500">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
  }

  // Render marketing routes with simple purple background - NO CONTEXT PROVIDERS
  console.log('[App] Rendering marketing routes with simple purple background');
  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: '#8b5cf6' }}>
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-white p-8">
          <h1 className="text-4xl font-bold mb-4">SOULo</h1>
          <p className="text-xl mb-6">Voice Journaling for Your Soul</p>
          <p className="text-lg">Coming Soon</p>
          <div className="mt-4">
            <a href="/app" className="text-blue-200 hover:text-white underline">
              Try the App
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
