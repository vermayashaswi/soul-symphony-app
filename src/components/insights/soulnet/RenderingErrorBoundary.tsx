
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

class RenderingErrorBoundary extends Component<Props, State> {
  private retryTimeoutRef: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    console.error('[RenderingErrorBoundary] Caught error:', error);
    
    return (prevState: State) => ({
      hasError: true, 
      error,
      errorCount: prevState.errorCount + 1
    });
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[RenderingErrorBoundary] Error details:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Auto-retry for certain recoverable errors
    const isRecoverableError = 
      error.message.includes('removeChild') ||
      error.message.includes('appendChild') ||
      error.message.includes('Three.js') ||
      error.message.includes('WebGL') ||
      this.state.errorCount < 3;

    if (isRecoverableError) {
      console.log('[RenderingErrorBoundary] Attempting auto-recovery...');
      this.retryTimeoutRef = setTimeout(() => {
        this.setState({ hasError: false, error: null });
      }, 1000);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutRef) {
      clearTimeout(this.retryTimeoutRef);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorCount: 0 });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Show fallback or retry interface
      return this.props.fallback || (
        <div className="flex items-center justify-center p-8 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Visualization Error</h3>
            <p className="text-muted-foreground mb-4">
              The 3D visualization encountered an error. 
              {this.state.errorCount > 2 && ' Switching to simplified mode.'}
            </p>
            <div className="space-x-2">
              <button
                className="px-4 py-2 bg-primary text-white rounded"
                onClick={this.handleRetry}
              >
                Retry
              </button>
              <button
                className="px-4 py-2 bg-gray-600 text-white rounded"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </button>
            </div>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm">Error Details</summary>
                <pre className="text-xs mt-2 p-2 bg-background rounded max-w-md overflow-auto">
                  {this.state.error.toString()}
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

export default RenderingErrorBoundary;
