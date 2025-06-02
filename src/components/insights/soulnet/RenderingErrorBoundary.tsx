
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
  lastErrorTime: number;
}

class RenderingErrorBoundary extends Component<Props, State> {
  private retryTimeoutRef: NodeJS.Timeout | null = null;
  private recoveryAttempts = 0;
  private maxRecoveryAttempts = 3;
  private recoveryDelay = 1000;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorCount: 0,
      isRecovering: false,
      lastErrorTime: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    console.error('[RenderingErrorBoundary] Enhanced error capture:', error);
    
    return {
      hasError: true, 
      error,
      isRecovering: false,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[RenderingErrorBoundary] Enhanced error details:', error, errorInfo);
    
    this.setState(prevState => ({
      errorCount: prevState.errorCount + 1
    }));

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Enhanced error classification
    const isRecoverableError = 
      error.message.includes('WebGL') ||
      error.message.includes('Canvas') ||
      error.message.includes('Three.js') ||
      error.message.includes('camera') ||
      error.message.includes('renderer') ||
      error.message.includes('mesh') ||
      error.message.includes('geometry') ||
      error.message.includes('material') ||
      error.message.includes('scene') ||
      error.stack?.includes('three') ||
      error.stack?.includes('fiber');

    const isRapidError = (Date.now() - this.state.lastErrorTime) < 2000;

    // Enhanced recovery logic
    if (isRecoverableError && 
        this.recoveryAttempts < this.maxRecoveryAttempts && 
        !isRapidError) {
      
      console.log('[RenderingErrorBoundary] Attempting enhanced recovery...');
      this.recoveryAttempts++;
      
      this.setState({ isRecovering: true });
      
      // Clear any existing timeout
      if (this.retryTimeoutRef) {
        clearTimeout(this.retryTimeoutRef);
      }
      
      // Progressive delay for recovery attempts
      const delay = this.recoveryDelay * this.recoveryAttempts;
      
      this.retryTimeoutRef = setTimeout(() => {
        console.log('[RenderingErrorBoundary] Executing recovery attempt', this.recoveryAttempts);
        this.setState({ 
          hasError: false, 
          error: null, 
          isRecovering: false 
        });
      }, delay);
    } else {
      console.log('[RenderingErrorBoundary] Recovery not attempted:', {
        isRecoverableError,
        recoveryAttempts: this.recoveryAttempts,
        maxAttempts: this.maxRecoveryAttempts,
        isRapidError
      });
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutRef) {
      clearTimeout(this.retryTimeoutRef);
    }
  }

  handleManualRetry = () => {
    console.log('[RenderingErrorBoundary] Manual retry initiated');
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
            <p className="text-sm text-muted-foreground">
              Recovering visualization... (Attempt {this.recoveryAttempts}/{this.maxRecoveryAttempts})
            </p>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      // Enhanced error classification for better user messaging
      const errorType = this.state.error?.message.includes('WebGL') ? 'WebGL' :
                       this.state.error?.message.includes('Canvas') ? 'Canvas' :
                       this.state.error?.message.includes('Three.js') ? '3D Engine' :
                       'Rendering';

      return this.props.fallback || (
        <div className="flex items-center justify-center p-8 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="text-center max-w-md">
            <h3 className="text-lg font-medium mb-2">
              {errorType} Visualization Error
            </h3>
            <p className="text-muted-foreground mb-4">
              {this.state.errorCount > this.maxRecoveryAttempts 
                ? 'The 3D visualization encountered persistent issues. This may be due to device limitations or browser compatibility.'
                : 'The 3D visualization encountered an error. Click retry to attempt recovery.'
              }
            </p>
            <div className="space-y-2">
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors"
                onClick={this.handleManualRetry}
              >
                Retry Visualization
              </button>
              {this.state.errorCount > 1 && (
                <p className="text-xs text-muted-foreground">
                  Error occurred {this.state.errorCount} times
                </p>
              )}
            </div>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm hover:text-primary">
                  Technical Details
                </summary>
                <pre className="text-xs mt-2 p-2 bg-background rounded max-w-md overflow-auto border">
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
