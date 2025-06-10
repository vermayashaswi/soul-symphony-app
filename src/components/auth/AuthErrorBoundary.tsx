
import React, { Component, ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { logError } from '@/components/debug/DebugPanel';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
  retryCount: number;
}

export class AuthErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      errorInfo: errorInfo.componentStack
    });

    logError(`Auth Error Boundary caught error: ${error.message}`, 'AuthErrorBoundary', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });

    // Show user-friendly error toast
    if (error.message.includes('profile') || error.message.includes('auth')) {
      toast.error('Authentication issue detected. Please refresh the page or sign in again.');
    } else {
      toast.error('An unexpected error occurred. Please try again.');
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
      
      toast.info('Retrying...');
    } else {
      toast.error('Maximum retry attempts reached. Please refresh the page.');
    }
  };

  handleRefresh = () => {
    window.location.reload();
  };

  handleSignOut = async () => {
    try {
      // Clear any stored auth state
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('authRedirectTo');
      
      // Redirect to onboarding
      window.location.href = '/app/onboarding';
    } catch (error) {
      // Force refresh if sign out fails
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="flex justify-center">
              <AlertCircle className="h-16 w-16 text-destructive" />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">Authentication Error</h2>
              <p className="text-muted-foreground">
                We encountered an issue with your authentication. This might be due to:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 text-left">
                <li>• Session expiration</li>
                <li>• Network connectivity issues</li>
                <li>• Temporary service interruption</li>
              </ul>
            </div>

            <div className="space-y-3">
              {this.state.retryCount < this.maxRetries ? (
                <Button 
                  onClick={this.handleRetry}
                  className="w-full"
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again ({this.maxRetries - this.state.retryCount} attempts left)
                </Button>
              ) : null}
              
              <Button 
                onClick={this.handleRefresh}
                className="w-full"
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Page
              </Button>
              
              <Button 
                onClick={this.handleSignOut}
                className="w-full"
                variant="secondary"
              >
                Start Fresh (Sign Out)
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left text-xs bg-muted p-3 rounded mt-4">
                <summary className="cursor-pointer font-medium">Error Details (Development)</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words">
                  {this.state.error.message}
                  {this.state.error.stack && (
                    <>
                      <br />
                      <br />
                      {this.state.error.stack}
                    </>
                  )}
                  {this.state.errorInfo && (
                    <>
                      <br />
                      <br />
                      Component Stack:
                      {this.state.errorInfo}
                    </>
                  )}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
