
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class AppErrorBoundary extends Component<Props, State> {
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
    console.error('[AppErrorBoundary] Application-level error:', error);
    
    return {
      hasError: true,
      error,
      retryCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[AppErrorBoundary] Full error details:', {
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });

    // Prevent infinite error loops
    if (this.state.retryCount >= this.maxRetries) {
      console.error('[AppErrorBoundary] Max retries reached, stopping auto-recovery');
      return;
    }

    // Auto-recovery for certain types of errors
    const isRecoverableError = 
      error.message.includes('Loading chunk') ||
      error.message.includes('Loading CSS chunk') ||
      error.message.includes('dynamically imported module');

    if (isRecoverableError) {
      console.log('[AppErrorBoundary] Attempting auto-recovery for loading error');
      setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: null,
          retryCount: prevState.retryCount + 1
        }));
      }, 1000);
    }
  }

  handleManualRetry = (): void => {
    console.log('[AppErrorBoundary] Manual retry initiated');
    this.setState({
      hasError: false,
      error: null,
      retryCount: this.state.retryCount + 1
    });
  };

  handleReload = (): void => {
    console.log('[AppErrorBoundary] Full page reload initiated');
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 24px',
              backgroundColor: '#fee2e2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              ⚠️
            </div>
            
            <h1 style={{
              fontSize: '24px',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 16px 0'
            }}>
              Application Error
            </h1>
            
            <p style={{
              fontSize: '16px',
              color: '#6b7280',
              margin: '0 0 24px 0',
              lineHeight: '1.5'
            }}>
              We encountered an unexpected error while loading the application. 
              This is usually temporary and can be resolved by trying again.
            </p>

            {this.state.retryCount >= this.maxRetries && (
              <p style={{
                fontSize: '14px',
                color: '#dc2626',
                margin: '0 0 24px 0',
                padding: '12px',
                backgroundColor: '#fef2f2',
                borderRadius: '6px',
                border: '1px solid #fecaca'
              }}>
                Multiple retry attempts failed. A page reload may be necessary.
              </p>
            )}

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={this.handleManualRetry}
                disabled={this.state.retryCount >= this.maxRetries}
                style={{
                  padding: '12px 24px',
                  backgroundColor: this.state.retryCount >= this.maxRetries ? '#d1d5db' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: this.state.retryCount >= this.maxRetries ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                Try Again {this.state.retryCount > 0 && `(${this.state.retryCount}/${this.maxRetries})`}
              </button>
              
              <button
                onClick={this.handleReload}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                Reload Page
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{
                marginTop: '24px',
                textAlign: 'left'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#6b7280'
                }}>
                  Development Error Details
                </summary>
                <pre style={{
                  fontSize: '12px',
                  backgroundColor: '#f3f4f6',
                  padding: '16px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  marginTop: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  {this.state.error.toString()}
                  {this.state.error.stack && '\n\nStack trace:\n' + this.state.error.stack}
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
