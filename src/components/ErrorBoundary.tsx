
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg max-w-3xl mx-auto my-8">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Something went wrong</h2>
          <div className="bg-white p-4 rounded-md mb-4">
            <p className="font-medium mb-2">Error:</p>
            <pre className="text-sm overflow-auto p-2 bg-gray-100 rounded">
              {this.state.error?.toString()}
            </pre>
          </div>
          {this.state.errorInfo && (
            <details className="bg-white p-4 rounded-md">
              <summary className="cursor-pointer font-medium mb-2">Component Stack</summary>
              <pre className="text-sm overflow-auto p-2 bg-gray-100 rounded">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
