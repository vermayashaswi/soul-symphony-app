
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { processingStateManager } from '@/utils/journal/processing-state-manager';
import { resetProcessingState } from '@/utils/audio-processing';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class JournalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Journal component error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }
  
  private handleReset = (): void => {
    // Reset all processing state to recover from errors
    resetProcessingState();
    processingStateManager.clearAll();
    
    // Call external reset handler if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
    
    // Reset the error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-md bg-destructive/10 border border-destructive text-center">
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="mb-4 text-muted-foreground">
            There was an error displaying journal entries. Please try again.
          </p>
          <Button 
            variant="outline"
            onClick={this.handleReset}
            className="mx-auto"
          >
            Reset and try again
          </Button>
          <details className="mt-4 text-xs text-left">
            <summary className="text-muted-foreground cursor-pointer">Error details</summary>
            <pre className="p-2 bg-background/80 rounded mt-2 overflow-auto max-h-[200px]">
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
