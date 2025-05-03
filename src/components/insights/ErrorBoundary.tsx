
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true,
      error: error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Error caught in boundary:", error, errorInfo);
    
    // Check for specific WebGL errors
    const isWebGLError = 
      error.message.includes('WebGL') || 
      error.message.includes('GPU process') ||
      error.message.includes('WEBGL_lose_context') ||
      error.message.includes('getContext');
      
    if (isWebGLError) {
      console.warn("WebGL rendering error detected in ErrorBoundary");
      // You could dispatch a custom event here if needed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('webglError', { detail: { error } }));
      }
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback or default fallback
      return this.props.fallback || (
        <div className="p-6 bg-background border rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-md"
          >
            Try Reloading
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
