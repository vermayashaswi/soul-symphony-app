
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
  isRecovering: boolean;
}

class RenderingErrorBoundary extends Component<Props, State> {
  private retryTimeoutRef: NodeJS.Timeout | null = null;
  private recoveryAttempts = 0;
  private maxRecoveryAttempts = 2;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorCount: 0,
      isRecovering: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    console.error('[RenderingErrorBoundary] Caught error:', error);
    
    return {
      hasError: true, 
      error,
      isRecovering: false
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[RenderingErrorBoundary] Error details:', error, errorInfo);
    
    this.setState(prevState => ({
      errorCount: prevState.errorCount + 1
    }));

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Only attempt auto-recovery for the first few errors and specific types
    const isRecoverableError = 
      error.message.includes('WebGL') ||
      error.message.includes('Canvas') ||
      error.message.includes('Three.js');

    if (isRecoverableError && this.recoveryAttempts < this.maxRecoveryAttempts) {
      console.log('[RenderingErrorBoundary] Attempting controlled recovery...');
      this.recoveryAttempts++;
      
      this.setState({ isRecovering: true });
      
      // Clear any existing timeout
      if (this.retryTimeoutRef) {
        clearTimeout(this.retryTimeoutRef);
      }
      
      this.retryTimeoutRef = setTimeout(() => {
        this.setState({ 
          hasError: false, 
          error: null, 
          isRecovering: false 
        });
      }, 2000); // Longer delay to prevent rapid cycling
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutRef) {
      clearTimeout(this.retryTimeoutRef);
    }
  }

  handleManualRetry = () => {
    this.recoveryAttempts = 0; // Reset recovery attempts on manual retry
    this.setState({ 
      hasError: false, 
      error: null, 
      errorCount: 0,
      isRecovering: false 
    });
  };

  render(): ReactNode {
    if (this.state.isRecovering) {
      return (
        <div className="flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Recovering visualization...</p>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      // Show fallback or retry interface
      return this.props.fallback || (
        <div className="flex items-center justify-center p-8 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Visualization Error</h3>
            <p className="text-muted-foreground mb-4">
              The 3D visualization encountered an error.
              {this.state.errorCount > this.maxRecoveryAttempts && ' Please try a manual restart.'}
            </p>
            <div className="space-x-2">
              <button
                className="px-4 py-2 bg-primary text-white rounded"
                onClick={this.handleManualRetry}
              >
                Retry Visualization
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
