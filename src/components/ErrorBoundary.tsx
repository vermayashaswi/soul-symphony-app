
import React, { Component, ErrorInfo, ReactNode } from 'react';
import EmergencyFallback from '@/routes/EmergencyFallback';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    console.error('[ErrorBoundary] Error caught:', error);
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Error details:', error, errorInfo);
    
    // If this is a loading loop error, try to break it
    if (error.message?.includes('Maximum update depth exceeded') || 
        error.message?.includes('Too many re-renders')) {
      console.error('[ErrorBoundary] Detected infinite loop, clearing state');
      localStorage.clear();
    }
  }

  public render() {
    if (this.state.hasError) {
      const resetErrorBoundary = () => {
        this.setState({ hasError: false, error: undefined });
      };

      return this.props.fallback || (
        <EmergencyFallback 
          error={this.state.error} 
          resetErrorBoundary={resetErrorBoundary} 
        />
      );
    }

    return this.props.children;
  }
}
