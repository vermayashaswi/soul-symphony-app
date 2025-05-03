
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isWebGLError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isWebGLError: false
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a WebGL error
    const errorMessage = error.message || '';
    const stack = error.stack || '';
    const isWebGLError = 
      errorMessage.includes('WebGL') || 
      errorMessage.includes('WEBGL') || 
      stack.includes('WebGL') ||
      errorMessage.includes('GPU') ||
      errorMessage.includes('rendering');
      
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error, 
      errorInfo: null,
      isWebGLError
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Check if this is a WebGL error
    const errorMessage = error.message || '';
    const errorInfoStr = JSON.stringify(errorInfo);
    const isWebGLError = 
      errorMessage.includes('WebGL') || 
      errorMessage.includes('WEBGL') || 
      errorInfoStr.includes('WebGL') ||
      errorMessage.includes('GPU') ||
      errorMessage.includes('rendering');
    
    // You can log the error to an error reporting service
    console.error("Component error:", error, errorInfo);
    
    this.setState({
      errorInfo,
      isWebGLError
    });
    
    // Notify parent component if callback provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg max-w-3xl mx-auto my-8">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-300 mb-2">
            {this.state.isWebGLError 
              ? "Visualization Error" 
              : "Something went wrong"}
          </h2>
          
          <p className="text-red-700 dark:text-red-300 mb-4">
            {this.state.isWebGLError 
              ? "There was a problem rendering the 3D visualization. This might be due to your device's graphics capabilities or browser settings."
              : "An unexpected error occurred while showing this component."}
          </p>
          
          <details className="bg-white dark:bg-gray-800 p-4 rounded-md mb-4">
            <summary className="cursor-pointer font-medium mb-2">Error details</summary>
            <pre className="text-sm overflow-auto p-2 bg-gray-100 dark:bg-gray-900 rounded">
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          
          {this.state.isWebGLError ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
              <button
                className="px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                onClick={() => {
                  // Try to recover by storing a preference for 2D mode
                  try {
                    localStorage.setItem('prefer-2d-visualization', 'true');
                  } catch (e) {
                    console.error('Failed to store visualization preference:', e);
                  }
                  window.location.reload();
                }}
              >
                Try simplified view
              </button>
            </div>
          ) : (
            <button
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
