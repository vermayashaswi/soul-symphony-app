
import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError?: (error: Error) => void;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorCount: number;
}

class RenderingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('[RenderingErrorBoundary] Error caught:', error);
    return { hasError: true, error, errorCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[RenderingErrorBoundary] Component error details:', {
      error: error.message,
      stack: error.stack,
      errorInfo,
      componentStack: errorInfo.componentStack
    });
    
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  handleRetry = () => {
    console.log('[RenderingErrorBoundary] Retry attempt:', this.state.errorCount + 1);
    this.setState(prevState => ({ 
      hasError: false, 
      error: undefined,
      errorCount: prevState.errorCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      const isRepeatedError = this.state.errorCount > 2;
      
      return (
        <div className="flex items-center justify-center p-10 bg-gray-100 dark:bg-gray-800 rounded-lg h-full min-h-[400px]">
          <div className="text-center max-w-md">
            <div className="mb-4">
              <svg 
                className="mx-auto h-12 w-12 text-red-500 mb-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
            </div>
            
            <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
              Visualization Error
            </h3>
            
            <p className="text-muted-foreground mb-4 text-sm">
              {isRepeatedError 
                ? "The visualization is having persistent issues. This might be due to browser compatibility or complex data processing."
                : this.state.error?.message || 'An error occurred while rendering the visualization'
              }
            </p>
            
            {isRepeatedError && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm">
                <p className="text-yellow-800 dark:text-yellow-300">
                  Try refreshing the page or switching to a different time range. 
                  If the issue persists, your browser may not fully support 3D graphics.
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <button 
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                onClick={this.handleRetry}
              >
                {isRepeatedError ? 'Try Once More' : 'Try Again'}
              </button>
              
              {this.state.errorCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Attempt {this.state.errorCount + 1}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RenderingErrorBoundary;
