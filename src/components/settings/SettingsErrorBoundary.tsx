
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { SimpleErrorBoundary } from '@/components/error-boundaries/SimpleErrorBoundary';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SettingsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('[SettingsErrorBoundary] Error caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SettingsErrorBoundary] Component stack:', errorInfo.componentStack);
    console.error('[SettingsErrorBoundary] Error details:', error.message, error.stack);
  }

  handleRetry = () => {
    console.log('[SettingsErrorBoundary] Retrying...');
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: undefined });
  };

  handleGoHome = () => {
    window.location.href = '/app';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '400px',
            padding: '24px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px'
              }}>
                ⚠️
              </div>
              <h1 style={{
                fontSize: '18px',
                fontWeight: '600',
                margin: '0 0 16px 0',
                color: '#1f2937'
              }}>
                Settings Error
              </h1>
            </div>
            
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: 0
              }}>
                We encountered an error loading your settings. This might be due to a temporary issue.
              </p>
            </div>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <button 
                onClick={this.handleRetry}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                🔄 Try Again
              </button>
              
              <button 
                onClick={this.handleGoHome}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                🏠 Go Home
              </button>
            </div>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{ marginTop: '16px' }}>
                <summary style={{
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  color: '#6b7280'
                }}>
                  Error Details
                </summary>
                <pre style={{
                  fontSize: '11px',
                  backgroundColor: '#f9fafb',
                  padding: '8px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '160px',
                  marginTop: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return (
      <SimpleErrorBoundary onError={(error) => console.error('[SettingsErrorBoundary] Nested error:', error)}>
        {this.props.children}
      </SimpleErrorBoundary>
    );
  }
}
