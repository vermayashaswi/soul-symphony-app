
/**
 * Enhanced loading skeleton with better state management
 */
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { X, RotateCcw } from 'lucide-react';
import { processingStateManager, EntryProcessingState } from '@/utils/journal/processing-state-manager';
import { cn } from '@/lib/utils';

interface JournalEntryLoadingSkeletonProps {
  count?: number;
  tempId?: string;
  isVisible?: boolean;
  onRetry?: (tempId: string) => void;
  onCancel?: (tempId: string) => void;
}

const JournalEntryLoadingSkeleton: React.FC<JournalEntryLoadingSkeletonProps> = ({
  count = 1,
  tempId,
  isVisible = true,
  onRetry,
  onCancel
}) => {
  const [processingState, setProcessingState] = useState<EntryProcessingState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shouldShow, setShouldShow] = useState(isVisible);
  
  useEffect(() => {
    if (!tempId) return;
    
    // Get initial state
    const entry = processingStateManager.getEntryById(tempId);
    if (entry) {
      setProcessingState(entry.state);
      setErrorMessage(entry.errorMessage || null);
      setShouldShow(entry.isVisible && isVisible);
    }
    
    // Listen for state changes
    const subscription = processingStateManager.entriesChanges().subscribe(entries => {
      const currentEntry = entries.find(e => e.tempId === tempId);
      if (currentEntry) {
        setProcessingState(currentEntry.state);
        setErrorMessage(currentEntry.errorMessage || null);
        setShouldShow(currentEntry.isVisible && isVisible);
      } else {
        // Entry was removed
        setShouldShow(false);
      }
    });
    
    // Listen for completion events
    const handleEntryCompleted = (event: CustomEvent) => {
      if (event.detail?.tempId === tempId) {
        console.log(`[LoadingSkeleton] Entry ${tempId} completed, hiding`);
        setShouldShow(false);
      }
    };
    
    const handleEntryHidden = (event: CustomEvent) => {
      if (event.detail?.tempId === tempId) {
        console.log(`[LoadingSkeleton] Entry ${tempId} hidden`);
        setShouldShow(false);
      }
    };
    
    window.addEventListener('processingEntryCompleted', handleEntryCompleted as EventListener);
    window.addEventListener('processingEntryHidden', handleEntryHidden as EventListener);
    
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('processingEntryCompleted', handleEntryCompleted as EventListener);
      window.removeEventListener('processingEntryHidden', handleEntryHidden as EventListener);
    };
  }, [tempId, isVisible]);
  
  const handleRetry = () => {
    if (tempId && onRetry) {
      onRetry(tempId);
    } else if (tempId) {
      processingStateManager.retryProcessing(tempId);
    }
  };
  
  const handleCancel = () => {
    if (tempId && onCancel) {
      onCancel(tempId);
    } else if (tempId) {
      processingStateManager.removeEntry(tempId);
    }
  };
  
  if (!shouldShow) {
    return null;
  }
  
  const isError = processingState === EntryProcessingState.ERROR;
  
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Card 
          key={`skeleton-${tempId || 'loading'}-${index}`}
          className={cn(
            "p-6 space-y-4 processing-card animate-pulse",
            isError && "border-red-200 bg-red-50"
          )}
          data-temp-id={tempId}
          data-processing="true"
          data-loading-skeleton="true"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                <Skeleton className="h-4 w-32" />
                {tempId && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {tempId.slice(-8)}
                  </span>
                )}
              </div>
              
              {isError ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-600 font-medium">
                    Processing failed
                  </p>
                  {errorMessage && (
                    <p className="text-xs text-red-500">
                      {errorMessage}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRetry}
                      className="text-xs"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Retry
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancel}
                      className="text-xs text-red-600"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-blue-600 font-medium">
                    Processing your recording...
                  </p>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-3/5" />
                  </div>
                </div>
              )}
            </div>
            
            {tempId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                className="text-muted-foreground hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <Skeleton className="h-3 w-20" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </Card>
      ))}
    </>
  );
};

export default JournalEntryLoadingSkeleton;
