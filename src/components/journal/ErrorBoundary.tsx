
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class JournalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error for debugging in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('[JournalErrorBoundary] Caught error:', error, errorInfo);
    }
    
    this.setState({
      error,
      errorInfo
    });
    
    // Dispatch event to clean up any stuck processing cards
    window.dispatchEvent(new CustomEvent('journalErrorOccurred', {
      detail: { 
        error: error.message, 
        timestamp: Date.now(),
        forceCleanup: true
      }
    }));
  }

  handleRetry = () => {
    // Call external reset handler if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
    
    // Reset the error boundary state
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    
    // Dispatch retry event
    window.dispatchEvent(new CustomEvent('journalRetryRequested', {
      detail: { timestamp: Date.now() }
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="w-full max-w-md mx-auto mt-8">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
            <CardTitle className="text-lg">Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              We encountered an error while processing your journal entry. This sometimes happens with the first entry.
            </p>
            
            <Button 
              onClick={this.handleRetry}
              className="w-full"
              variant="default"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left">
                <summary className="text-xs cursor-pointer">Error Details</summary>
                <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
