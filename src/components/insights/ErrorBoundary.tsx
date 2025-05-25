
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isDOMError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutRef: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      isDOMError: false
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a DOM manipulation error
    const isDOMError = error.message.includes('removeChild') || 
                      error.message.includes('appendChild') ||
                      error.message.includes('insertBefore') ||
                      error.message.includes('replaceChild') ||
                      error.message.includes('Node was not found') ||
                      error.message.includes('Cannot read properties of null');

    return { 
      hasError: true, 
      error,
      isDOMError
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught error:", error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // For DOM errors, attempt automatic recovery after a short delay
    if (this.state.isDOMError) {
      console.log("DOM error detected, attempting recovery...");
      this.retryTimeoutRef = setTimeout(() => {
        this.setState({ hasError: false, error: null, isDOMError: false });
      }, 1000);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutRef) {
      clearTimeout(this.retryTimeoutRef);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isDOMError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // For DOM errors, show a minimal retry interface
      if (this.state.isDOMError) {
        return this.props.fallback || (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg max-w-md mx-auto my-4">
            <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-300 mb-2">
              Temporary Display Issue
            </h3>
            <p className="text-yellow-700 dark:text-yellow-400 mb-3">
              The interface encountered a temporary issue. This usually resolves automatically.
            </p>
            <button
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
              onClick={this.handleRetry}
            >
              Refresh View
            </button>
          </div>
        );
      }

      // For other errors, show detailed error information
      return this.props.fallback || (
        <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg max-w-3xl mx-auto my-8">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-300 mb-2">Something went wrong</h2>
          <details className="bg-white dark:bg-gray-800 p-4 rounded-md">
            <summary className="cursor-pointer font-medium mb-2">Error details</summary>
            <pre className="text-sm overflow-auto p-2 bg-gray-100 dark:bg-gray-900 rounded">
              {this.state.error?.toString()}
            </pre>
          </details>
          <div className="mt-4 space-x-2">
            <button
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              onClick={this.handleRetry}
            >
              Try Again
            </button>
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
