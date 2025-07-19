import { Suspense, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/contexts/AuthContext';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { SafeAreaProvider } from '@/components/layout/SafeAreaProvider';
import SmartChat from '@/pages/SmartChat';
import Journal from '@/pages/Journal';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import VerifyEmail from '@/pages/VerifyEmail';
import Insights from '@/pages/Insights';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';

const queryClient = new QueryClient();

function App() {
  const { user, loading } = useAuth();
  const { setInitialLanguage } = useTranslation();

  useEffect(() => {
    setInitialLanguage();
  }, [setInitialLanguage]);

  if (loading) {
    return <div>Loading...</div>;
  }

  const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
    return user ? <>{children}</> : <Navigate to="/login" />;
  };

  const PublicRoute = ({ children }: { children: React.ReactNode }) => {
    return !user ? <>{children}</> : <Navigate to="/" />;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <AuthProvider>
              <TranslationProvider>
                <SafeAreaProvider>
                  <BrowserRouter>
                    <div className="min-h-screen bg-background">
                      <Routes>
                        <Route
                          path="/"
                          element={
                            <PrivateRoute>
                              <SmartChat />
                            </PrivateRoute>
                          }
                        />
                        <Route
                          path="/journal"
                          element={
                            <PrivateRoute>
                              <Journal />
                            </PrivateRoute>
                          }
                        />
                        <Route
                          path="/insights"
                          element={
                            <PrivateRoute>
                              <Insights />
                            </PrivateRoute>
                          }
                        />
                        <Route
                          path="/settings"
                          element={
                            <PrivateRoute>
                              <Settings />
                            </PrivateRoute>
                          }
                        />
                        <Route
                          path="/login"
                          element={
                            <PublicRoute>
                              <Login />
                            </PublicRoute>
                          }
                        />
                        <Route
                          path="/register"
                          element={
                            <PublicRoute>
                              <Register />
                            </PublicRoute>
                          }
                        />
                        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                        <Route path="/reset-password/:token" element={<PublicRoute><ResetPassword /></PublicRoute>} />
                        <Route path="/verify-email/:token" element={<PublicRoute><VerifyEmail /></PublicRoute>} />
                      </Routes>
                    </div>
                    <Toaster />
                  </BrowserRouter>
                </SafeAreaProvider>
              </TranslationProvider>
            </AuthProvider>
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
