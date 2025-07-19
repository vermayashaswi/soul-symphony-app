
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

export class ViewportErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    console.error('[ViewportErrorBoundary] Viewport error caught:', error);
    
    // Check if it's a hook rendering error
    const isHookError = error.message.includes('hook') || 
                       error.message.includes('render') ||
                       error.message.includes('more hooks than during the previous render');
    
    if (isHookError) {
      console.error('[ViewportErrorBoundary] Hook rendering error detected:', error.message);
    }
    
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ViewportErrorBoundary] Error details:', error.message, error.stack);
    console.error('[ViewportErrorBoundary] Component stack:', errorInfo.componentStack);
    
    this.setState({
      error,
      errorInfo,
      retryCount: this.state.retryCount + 1
    });

    // For hook errors, force a complete re-render by clearing any cached state
    if (error.message.includes('hook')) {
      console.log('[ViewportErrorBoundary] Hook error detected, clearing component state');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }

  handleRetry = () => {
    console.log('[ViewportErrorBoundary] Retrying viewport render...');
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined 
    });
  };

  handleGoHome = () => {
    console.log('[ViewportErrorBoundary] Navigating to home');
    window.location.href = '/app/home';
  };

  handleReload = () => {
    console.log('[ViewportErrorBoundary] Reloading application');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isHookError = this.state.error?.message.includes('hook') || 
                         this.state.error?.message.includes('render');

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
              <CardTitle className="text-lg">
                {isHookError ? 'Component Rendering Error' : 'Navigation Error'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {isHookError 
                  ? 'The app encountered a component rendering error. This will be resolved automatically.'
                  : 'The app encountered a navigation error. Please try refreshing or going home.'}
              </p>
              
              {isHookError && (
                <p className="text-xs text-yellow-600">
                  Reloading automatically in a few seconds...
                </p>
              )}
              
              <div className="flex flex-col gap-2">
                {!isHookError && (
                  <Button 
                    onClick={this.handleRetry}
                    className="w-full"
                    variant="default"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}
                
                <Button 
                  onClick={this.handleReload}
                  className="w-full"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload App
                </Button>

                <Button 
                  onClick={this.handleGoHome}
                  className="w-full"
                  variant="outline"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              </div>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mt-4">
                  <summary className="text-xs cursor-pointer font-medium">Error Details</summary>
                  <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
