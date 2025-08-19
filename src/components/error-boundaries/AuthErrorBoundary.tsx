import React, { Component, ReactNode } from 'react';

interface AuthErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

interface AuthErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Error boundary specifically for auth-related errors
 * Provides fallback UI when auth context is not available
 */
export class AuthErrorBoundary extends Component<AuthErrorBoundaryProps, AuthErrorBoundaryState> {
  constructor(props: AuthErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    // Check if this is an auth provider error
    if (error.message?.includes('useAuth must be used within an AuthProvider')) {
      console.warn('[AuthErrorBoundary] Caught auth provider error, providing fallback');
      return { 
        hasError: true, 
        errorMessage: 'Authentication context not available' 
      };
    }
    
    // Let other errors bubble up
    return { hasError: false, errorMessage: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (error.message?.includes('useAuth must be used within an AuthProvider')) {
      console.error('[AuthErrorBoundary] Auth provider error caught:', error, errorInfo);
      
      // Try to recover after a short delay
      setTimeout(() => {
        console.log('[AuthErrorBoundary] Attempting to recover from auth error');
        this.setState({ hasError: false, errorMessage: null });
      }, 100);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default fallback - render children without auth context
      return this.props.children;
    }

    return this.props.children;
  }
}