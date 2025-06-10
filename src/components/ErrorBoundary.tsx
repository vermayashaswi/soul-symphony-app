
import React, { Component, ReactNode } from 'react';
import { AuthErrorBoundary } from './auth/AuthErrorBoundary';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <AuthErrorBoundary>{this.props.children}</AuthErrorBoundary>;
    }

    return this.props.children;
  }
}
