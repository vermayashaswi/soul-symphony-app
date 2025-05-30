
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { AlertCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const SettingsLoadingSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-3xl mx-auto px-4 pt-2">
        <div className="mb-6">
          <Skeleton className="h-9 w-32 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        
        <div className="space-y-6">
          {/* Profile skeleton */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-7 w-32" />
            </div>
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="flex-1 space-y-4 text-center sm:text-left">
                <Skeleton className="h-6 w-48 mx-auto sm:mx-0" />
                <Skeleton className="h-4 w-32 mx-auto sm:mx-0" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-16 rounded-lg" />
                  <Skeleton className="h-16 rounded-lg" />
                </div>
              </div>
            </div>
          </Card>
          
          {/* Subscription skeleton */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-20" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-20 rounded-lg" />
            </div>
          </Card>
          
          {/* Appearance skeleton */}
          <Card className="p-6">
            <Skeleton className="h-6 w-24 mb-4" />
            <div className="space-y-4">
              <div>
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-10 w-80" />
              </div>
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <div className="flex flex-wrap gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <Skeleton className="h-10 w-16 rounded" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

interface SettingsLoadingWrapperProps {
  isLoading: boolean;
  error?: string | null;
  children: React.ReactNode;
  loadTime?: number | null;
  showPerformanceAlert?: boolean;
}

export const SettingsLoadingWrapper: React.FC<SettingsLoadingWrapperProps> = ({
  isLoading,
  error,
  children,
  loadTime,
  showPerformanceAlert = false
}) => {
  const [showSlowLoadingWarning, setShowSlowLoadingWarning] = useState(false);

  console.log('[SettingsLoadingWrapper] Rendering - isLoading:', isLoading, 'error:', error);

  // Show slow loading warning after 3 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (isLoading) {
      timer = setTimeout(() => {
        setShowSlowLoadingWarning(true);
      }, 3000);
    } else {
      setShowSlowLoadingWarning(false);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20">
        {showSlowLoadingWarning && (
          <div className="max-w-3xl mx-auto px-4 pt-2 mb-4">
            <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
              <Clock className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                <TranslatableText text="Settings are taking longer than usual to load. Please wait..." />
              </AlertDescription>
            </Alert>
          </div>
        )}
        <SettingsLoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2 text-destructive">
            <TranslatableText text="Loading Error" />
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            <TranslatableText text="Failed to load settings:" /> {error}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="text-sm text-primary hover:underline"
          >
            <TranslatableText text="Try refreshing the page" />
          </button>
          {loadTime && (
            <p className="text-xs text-muted-foreground mt-2">
              Load time: {loadTime}ms
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <>
      {showPerformanceAlert && loadTime && loadTime > 3000 && (
        <div className="max-w-3xl mx-auto px-4 pt-2 mb-4">
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <TranslatableText text={`Settings loaded in ${loadTime}ms. Consider refreshing if performance seems slow.`} />
            </AlertDescription>
          </Alert>
        </div>
      )}
      {children}
    </>
  );
};
