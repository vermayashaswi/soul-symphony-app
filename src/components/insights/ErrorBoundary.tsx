
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error("Insights ErrorBoundary caught error:", error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Insights ErrorBoundary componentDidCatch:", error);
    console.error("Error stack:", errorInfo.componentStack);
  }
  
  resetErrorState = () => {
    console.log('Insights ErrorBoundary: Resetting error state');
    this.setState({ hasError: false, error: null });
    
    // Wait for state to update before calling onReset
    setTimeout(() => {
      if (this.props.onReset) {
        console.log('Insights ErrorBoundary: Calling onReset callback');
        this.props.onReset();
      } else {
        // If no onReset provided, reload the page
        console.log('Insights ErrorBoundary: No onReset provided, reloading page');
        window.location.reload();
      }
    }, 0);
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || (
        <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg max-w-3xl mx-auto my-8">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-300 mb-2">Something went wrong</h2>
          <details className="bg-white dark:bg-gray-800 p-4 rounded-md my-4">
            <summary className="cursor-pointer font-medium mb-2">Error details</summary>
            <pre className="text-sm overflow-auto p-2 bg-gray-100 dark:bg-gray-900 rounded">
              {this.state.error?.toString() || 'Unknown error'}
            </pre>
          </details>
          <Button
            className="mt-4 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            onClick={this.resetErrorState}
          >
            <RefreshCw className="w-4 h-4 mr-2" /> 
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
