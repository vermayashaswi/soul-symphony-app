
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('[AuthErrorBoundary] Auth error caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[AuthErrorBoundary] Auth error details:', error, errorInfo);
    
    // Show user-friendly error message
    if (error.message.includes('useAuth must be used within an AuthProvider')) {
      toast.error('Authentication system is initializing. Please wait a moment.');
    } else {
      toast.error('Authentication error occurred. Please refresh the page.');
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center p-6 max-w-md">
            <h2 className="text-xl font-semibold mb-4">Authentication Error</h2>
            <p className="text-muted-foreground mb-4">
              There was a problem with the authentication system. This usually resolves by refreshing the page.
            </p>
            <div className="space-x-2">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 text-white rounded-md"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AuthErrorBoundary;
