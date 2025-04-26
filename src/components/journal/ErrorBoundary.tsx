
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
    console.error('Journal ErrorBoundary caught an error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Journal ErrorBoundary componentDidCatch:', error);
    console.error('Component stack:', info.componentStack);
  }
  
  resetErrorState = () => {
    console.log('Journal ErrorBoundary: Resetting error state');
    this.setState({ hasError: false, error: null });
    
    // Wait for state to update before calling onReset
    setTimeout(() => {
      if (this.props.onReset) {
        console.log('Journal ErrorBoundary: Calling onReset callback');
        this.props.onReset();
      }
    }, 0);
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Otherwise show default error UI
      return (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">
                  Something went wrong
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full sm:w-auto border-red-500 text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/40"
              onClick={this.resetErrorState}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> 
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
