
import React, { Component, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface SubscriptionErrorBoundaryProps {
  children: ReactNode;
}

interface SubscriptionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SubscriptionErrorBoundary extends Component<
  SubscriptionErrorBoundaryProps,
  SubscriptionErrorBoundaryState
> {
  constructor(props: SubscriptionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SubscriptionErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SubscriptionErrorBoundary] Subscription component error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <AlertTriangle className="h-8 w-8 text-orange-500" />
            <div>
              <h3 className="text-lg font-semibold mb-2">
                <TranslatableText text="Subscription Loading Error" />
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                <TranslatableText text="There was an issue loading your subscription information." />
              </p>
            </div>
            <Button onClick={this.handleRetry} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              <TranslatableText text="Try Again" />
            </Button>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}
