
import React from 'react';

interface MarketingErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface MarketingErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class MarketingErrorBoundary extends React.Component<
  MarketingErrorBoundaryProps,
  MarketingErrorBoundaryState
> {
  constructor(props: MarketingErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): MarketingErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Marketing] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center px-4">
            <h1 className="text-2xl font-bold mb-4 text-gray-900">Something went wrong</h1>
            <p className="text-gray-600 mb-4">Please refresh the page to try again.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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
