
import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Settings, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  fallback?: ReactNode;
  maxRetries?: number;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorType: 'webgl' | 'translation' | 'network' | 'memory' | 'unknown';
  retryCount: number;
  lastErrorTime: number;
}

class SoulNetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorType: 'unknown',
      retryCount: 0,
      lastErrorTime: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    console.error('[SoulNetErrorBoundary] Error caught:', error);
    
    let errorType: State['errorType'] = 'unknown';
    
    // Classify error type
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('webgl') || errorMessage.includes('canvas') || errorMessage.includes('three')) {
      errorType = 'webgl';
    } else if (errorMessage.includes('translate') || errorMessage.includes('font') || errorMessage.includes('html')) {
      errorType = 'translation';
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
      errorType = 'network';
    } else if (errorMessage.includes('memory') || errorMessage.includes('performance')) {
      errorType = 'memory';
    }
    
    return {
      hasError: true,
      error,
      errorType,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[SoulNetErrorBoundary] Detailed error info:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorType: this.state.errorType
    });
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    const maxRetries = this.props.maxRetries || 3;
    const timeSinceLastError = Date.now() - this.state.lastErrorTime;
    
    // Reset retry count if enough time has passed
    const resetTime = 60000; // 1 minute
    const newRetryCount = timeSinceLastError > resetTime ? 1 : this.state.retryCount + 1;
    
    if (newRetryCount > maxRetries) {
      console.warn('[SoulNetErrorBoundary] Max retries exceeded');
      return;
    }
    
    console.log(`[SoulNetErrorBoundary] Retry attempt ${newRetryCount}/${maxRetries}`);
    
    this.setState({
      hasError: false,
      error: undefined,
      retryCount: newRetryCount,
      lastErrorTime: 0
    });
  };

  getErrorMessage = (): string => {
    const { errorType, retryCount } = this.state;
    const maxRetries = this.props.maxRetries || 3;
    
    if (retryCount >= maxRetries) {
      switch (errorType) {
        case 'webgl':
          return 'Your browser does not support the required 3D graphics features. Please try using Chrome or Firefox with hardware acceleration enabled.';
        case 'translation':
          return 'Text rendering is having persistent issues. This may be due to font loading problems or translation service limitations.';
        case 'network':
          return 'Network connectivity issues are preventing the visualization from loading properly.';
        case 'memory':
          return 'The visualization requires too much memory. Try reducing the time range or using a device with more available memory.';
        default:
          return 'The Soul-Net visualization encountered a persistent error and cannot be displayed.';
      }
    }
    
    switch (errorType) {
      case 'webgl':
        return 'Graphics rendering error. Your browser may need WebGL support.';
      case 'translation':
        return 'Text display error. Some labels may not appear correctly.';
      case 'network':
        return 'Network connection issue. Please check your internet connection.';
      case 'memory':
        return 'Memory usage too high. Consider reducing data complexity.';
      default:
        return 'An unexpected error occurred while loading the visualization.';
    }
  };

  getSuggestions = (): string[] => {
    const { errorType } = this.state;
    
    switch (errorType) {
      case 'webgl':
        return [
          'Use Chrome or Firefox browser',
          'Enable hardware acceleration in browser settings',
          'Update your graphics drivers',
          'Close other browser tabs to free up resources'
        ];
      case 'translation':
        return [
          'Try switching to English language',
          'Refresh the page to reload fonts',
          'Disable browser translation extensions temporarily'
        ];
      case 'network':
        return [
          'Check your internet connection',
          'Try refreshing the page',
          'Disable VPN if using one'
        ];
      case 'memory':
        return [
          'Select a smaller date range',
          'Close other browser tabs',
          'Use a device with more memory'
        ];
      default:
        return [
          'Refresh the page',
          'Try a different browser',
          'Clear browser cache and cookies'
        ];
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      const { retryCount, errorType } = this.state;
      const maxRetries = this.props.maxRetries || 3;
      const canRetry = retryCount < maxRetries;
      const suggestions = this.getSuggestions();
      
      return (
        <div className="flex items-center justify-center p-8 bg-background border border-border rounded-lg min-h-[400px]">
          <div className="text-center max-w-md space-y-6">
            <div className="flex justify-center">
              {errorType === 'webgl' && <Settings className="h-12 w-12 text-amber-500" />}
              {errorType === 'translation' && <AlertTriangle className="h-12 w-12 text-orange-500" />}
              {errorType === 'network' && <Wifi className="h-12 w-12 text-red-500" />}
              {(errorType === 'memory' || errorType === 'unknown') && <AlertTriangle className="h-12 w-12 text-red-500" />}
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                <TranslatableText text="Soul-Net Visualization Error" forceTranslate={true} />
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                <TranslatableText text={this.getErrorMessage()} forceTranslate={true} />
              </p>
            </div>
            
            {suggestions.length > 0 && (
              <div className="p-4 bg-muted rounded-lg text-left">
                <h4 className="font-medium text-foreground mb-2">
                  <TranslatableText text="Suggestions:" forceTranslate={true} />
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>
                      • <TranslatableText text={suggestion} forceTranslate={true} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              {canRetry && (
                <Button onClick={this.handleRetry} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <TranslatableText 
                    text={retryCount === 0 ? "Try Again" : `Try Again (${retryCount}/${maxRetries})`} 
                    forceTranslate={true} 
                  />
                </Button>
              )}
              
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()} 
                className="w-full"
              >
                <TranslatableText text="Refresh Page" forceTranslate={true} />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SoulNetErrorBoundary;
