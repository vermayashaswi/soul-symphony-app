
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutRef: NodeJS.Timeout | null = null;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('[InsightsErrorBoundary] Error caught:', error);
    
    return { 
      hasError: true, 
      error,
      retryCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[InsightsErrorBoundary] Component details:', {
      error: error.toString(),
      componentStack: errorInfo.componentStack
    });
    
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (e) {
        console.error('[InsightsErrorBoundary] Error in onError callback:', e);
      }
    }

    // Auto-recovery for certain DOM errors
    const isDOMError = error.message.includes('removeChild') || 
                      error.message.includes('appendChild') ||
                      error.message.includes('insertBefore') ||
                      error.message.includes('Node was not found');

    if (isDOMError && this.state.retryCount < this.maxRetries) {
      console.log('[InsightsErrorBoundary] DOM error detected, attempting recovery...');
      this.retryTimeoutRef = setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: null,
          retryCount: prevState.retryCount + 1
        }));
      }, 1000);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutRef) {
      clearTimeout(this.retryTimeoutRef);
    }
  }

  handleRetry = () => {
    console.log('[InsightsErrorBoundary] Manual retry triggered');
    this.setState(prevState => ({ 
      hasError: false, 
      error: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Check if we've exceeded retry attempts
      const hasExceededRetries = this.state.retryCount >= this.maxRetries;
      const isDOMError = this.state.error?.message.includes('removeChild') || 
                        this.state.error?.message.includes('appendChild') ||
                        this.state.error?.message.includes('insertBefore') ||
                        this.state.error?.message.includes('Node was not found');

      if (isDOMError && !hasExceededRetries) {
        return (
          <div style={{
            padding: '16px',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            maxWidth: '400px',
            margin: '16px auto'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '500',
              color: '#92400e',
              margin: '0 0 8px 0'
            }}>
              Temporary Display Issue
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#b45309',
              margin: '0 0 12px 0'
            }}>
              The interface encountered a temporary issue. Auto-recovery in progress...
            </p>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Refresh View
            </button>
          </div>
        );
      }

      // For other errors or exceeded retries
      return (
        <div style={{
          padding: '24px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          maxWidth: '600px',
          margin: '24px auto'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#dc2626',
            margin: '0 0 16px 0'
          }}>
            Something went wrong
          </h2>
          
          {hasExceededRetries && (
            <p style={{
              fontSize: '14px',
              color: '#dc2626',
              margin: '0 0 16px 0',
              padding: '12px',
              backgroundColor: '#fee2e2',
              borderRadius: '4px'
            }}>
              Multiple recovery attempts failed. Please try reloading the page.
            </p>
          )}
          
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <button
              onClick={this.handleRetry}
              disabled={hasExceededRetries}
              style={{
                padding: '10px 20px',
                backgroundColor: hasExceededRetries ? '#d1d5db' : '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: hasExceededRetries ? 'not-allowed' : 'pointer'
              }}
            >
              Try Again {this.state.retryCount > 0 && `(${this.state.retryCount}/${this.maxRetries})`}
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Reload Page
            </button>
          </div>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details>
              <summary style={{
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                Error details
              </summary>
              <pre style={{
                fontSize: '12px',
                backgroundColor: 'white',
                padding: '12px',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
                border: '1px solid #e5e7eb'
              }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
