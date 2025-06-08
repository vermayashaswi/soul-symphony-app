
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  attemptCount: number;
}

export class SettingsErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      attemptCount: 0 
    };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('[SettingsErrorBoundary] Error caught:', error);
    console.error('[SettingsErrorBoundary] Error stack:', error.stack);
    return { 
      hasError: true, 
      error,
      attemptCount: 0 
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SettingsErrorBoundary] Component stack:', errorInfo.componentStack);
    console.error('[SettingsErrorBoundary] Error details:', error.message, error.stack);
    console.error('[SettingsErrorBoundary] Error info:', errorInfo);
    
    // Log to console for debugging
    console.group('[SettingsErrorBoundary] Full Error Report');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();
    
    this.setState({
      error,
      errorInfo,
      attemptCount: this.state.attemptCount + 1
    });

    // Auto-retry for the first error (might be temporary)
    if (this.state.attemptCount === 0) {
      console.log('[SettingsErrorBoundary] Auto-retrying after first error...');
      this.resetTimeoutId = setTimeout(() => {
        this.handleRetry();
      }, 2000);
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  handleRetry = () => {
    console.log('[SettingsErrorBoundary] Manual retry initiated');
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined 
    });
  };

  handleGoHome = () => {
    console.log('[SettingsErrorBoundary] Navigating to home');
    window.location.href = '/app/home';
  };

  handleGoBack = () => {
    console.log('[SettingsErrorBoundary] Going back');
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      console.log('[SettingsErrorBoundary] Rendering error UI, attempt count:', this.state.attemptCount);
      
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isRepeatedError = this.state.attemptCount > 1;

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
              <CardTitle className="text-lg">
                <TranslatableText text="Settings Error" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {isRepeatedError ? (
                  <TranslatableText text="Settings are having persistent issues. Try going back or refreshing the page." />
                ) : (
                  <TranslatableText text="We encountered an error loading your settings. This might be due to a temporary issue." />
                )}
              </p>
              
              <div className="flex flex-col gap-2">
                {!isRepeatedError && (
                  <Button 
                    onClick={this.handleRetry}
                    className="w-full"
                    variant="default"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    <TranslatableText text="Try Again" />
                  </Button>
                )}
                
                <Button 
                  onClick={this.handleGoBack}
                  className="w-full"
                  variant="outline"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  <TranslatableText text="Go Back" />
                </Button>
                
                <Button 
                  onClick={this.handleGoHome}
                  className="w-full"
                  variant="outline"
                >
                  <Home className="h-4 w-4 mr-2" />
                  <TranslatableText text="Go Home" />
                </Button>
              </div>
              
              {(process.env.NODE_ENV === 'development' || true) && this.state.error && (
                <details className="text-left mt-4">
                  <summary className="text-xs cursor-pointer font-medium">
                    Error Details (Attempt #{this.state.attemptCount})
                  </summary>
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
