
import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError?: (error: Error) => void;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class RenderingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('[RenderingErrorBoundary] Error caught:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[RenderingErrorBoundary] Component error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="flex items-center justify-center p-10 bg-gray-100 dark:bg-gray-800 rounded-lg h-full">
          <div className="text-center">
            <h3 className="text-lg font-medium text-red-600">Visualization Error</h3>
            <p className="text-muted-foreground mt-2">
              {this.state.error?.message || 'An error occurred while rendering the visualization'}
            </p>
            <button 
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
              onClick={() => this.setState({ hasError: false, error: undefined })}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RenderingErrorBoundary;
