import React, { Component, ErrorInfo, ReactNode } from 'react';
import { mobileErrorHandler } from '@/services/mobileErrorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    // Report to mobile error handler
    mobileErrorHandler.handleError({
      type: 'crash',
      message: error.message,
      stack: error.stack,
      context: JSON.stringify(errorInfo),
      timestamp: Date.now()
    });

    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-6 max-w-md mx-auto">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              Something went wrong
            </h2>
            <p className="text-muted-foreground mb-6">
              We've encountered an unexpected error. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors"
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