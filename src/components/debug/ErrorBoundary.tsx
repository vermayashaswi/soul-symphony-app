
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console
    console.error("React Error Boundary caught an error:", error);
    console.error("Component Stack:", errorInfo.componentStack);

    // Call the optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use provided fallback or show default error message
      return this.props.fallback || (
        <div className="p-4 m-4 bg-red-50 border border-red-300 rounded-md text-red-700">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="mb-2">We encountered an error rendering this component.</p>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Error details</summary>
            <p className="mt-1 font-mono whitespace-pre-wrap">
              {this.state.error?.toString()}
            </p>
          </details>
          <button 
            className="mt-3 px-3 py-1 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
