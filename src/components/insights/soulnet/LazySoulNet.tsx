
import React, { Suspense, useState, useEffect } from 'react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { TimeRange } from '@/hooks/use-insights-data';

const SoulNet = React.lazy(() => import('../SoulNet'));

interface LazySoulNetProps {
  userId: string | undefined;
  timeRange: TimeRange;
}

const LazySoulNetFallback: React.FC = () => (
  <div className="bg-background rounded-xl shadow-sm border w-full p-6">
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <h3 className="text-lg font-medium">
        <TranslatableText 
          text="Loading Soul-Net..." 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
        />
      </h3>
    </div>
  </div>
);

const LazySoulNetError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="bg-background rounded-xl shadow-sm border w-full p-6">
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="text-yellow-500 text-2xl">⚠️</div>
      <h3 className="text-lg font-medium">
        <TranslatableText 
          text="Soul-Net Temporarily Unavailable" 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
        />
      </h3>
      <p className="text-sm text-muted-foreground text-center">
        <TranslatableText 
          text="The visualization is taking longer than expected. You can continue using other insights features." 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
        />
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors"
      >
        <TranslatableText 
          text="Try Again" 
          forceTranslate={true}
          enableFontScaling={true}
          scalingContext="general"
        />
      </button>
    </div>
  </div>
);

export const LazySoulNet: React.FC<LazySoulNetProps> = ({ userId, timeRange }) => {
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Reset error state when props change
  useEffect(() => {
    setHasError(false);
    setLoadingTimeout(false);
  }, [userId, timeRange]);

  // Set a timeout to show graceful degradation
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoadingTimeout(true);
    }, 8000); // 8 second timeout

    return () => clearTimeout(timeout);
  }, [retryKey]);

  const handleRetry = () => {
    setHasError(false);
    setLoadingTimeout(false);
    setRetryKey(prev => prev + 1);
  };

  const handleError = () => {
    console.log('[LazySoulNet] Component failed to load, showing graceful degradation');
    setHasError(true);
  };

  if (hasError || loadingTimeout) {
    return <LazySoulNetError onRetry={handleRetry} />;
  }

  return (
    <Suspense fallback={<LazySoulNetFallback />}>
      <ErrorBoundary onError={handleError}>
        <SoulNet key={retryKey} userId={userId} timeRange={timeRange} />
      </ErrorBoundary>
    </Suspense>
  );
};

// Simple error boundary for the lazy component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[LazySoulNet] Error caught by boundary:', error, errorInfo);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export default LazySoulNet;
