
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { resetProcessingState } from '@/utils/audio/processing-state';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class JournalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error: error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Caught error in JournalErrorBoundary", error, errorInfo);
    this.setState({ errorInfo: errorInfo });
  }

  handleRetry = () => {
    // Reset the state to attempt re-rendering the component
    this.setState({ hasError: false, error: null, errorInfo: null }, () => {
      // Optionally, trigger a re-fetch of data or re-initialize the component
      window.location.reload();
    });
  };
  
  handleResetProcessing = () => {
    console.log('[JournalErrorBoundary] Resetting processing state due to error');
    resetProcessingState();
    this.setState({ hasError: false, error: null, errorInfo: null }, () => {
      window.location.reload();
    });
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="flex flex-col items-center justify-center p-4">
          <h2 className="text-xl font-semibold mb-4">Something went wrong in the Journal section.</h2>
          <p className="text-gray-600 mb-4">
            We've caught an error, and the Journal component could not be displayed properly.
          </p>
          <div className="space-x-4">
            <Button variant="outline" onClick={this.handleRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try to Reload
            </Button>
            <Button variant="destructive" onClick={this.handleResetProcessing}>
              Reset Audio Processing
            </Button>
          </div>
          {this.state.errorInfo && (
            <details className="mt-4">
              <summary>Error Details</summary>
              <p className="text-sm text-red-500">{this.state.error?.message}</p>
              <pre className="text-xs text-red-500 overflow-auto">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default JournalErrorBoundary;
