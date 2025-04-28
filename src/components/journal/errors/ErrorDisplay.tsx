
import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface ErrorDisplayProps {
  entriesError?: string | null;
  processingError?: string | null;
  onRetryLoading: () => void;
  onTryAgainProcessing: () => void;
}

export function ErrorDisplay({
  entriesError,
  processingError,
  onRetryLoading,
  onTryAgainProcessing
}: ErrorDisplayProps) {
  if (entriesError) {
    return (
      <div className="mt-8 p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-200">
              <TranslatableText text={`Error loading your journal entries: ${entriesError}`} />
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full sm:w-auto border-red-500 text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/40"
            onClick={onRetryLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" /> 
            <TranslatableText text="Retry Loading" />
          </Button>
        </div>
      </div>
    );
  }

  if (processingError) {
    return (
      <div className="mb-6 p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-200">
              <TranslatableText text={`Error processing your recording: ${processingError}`} />
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full sm:w-auto border-red-500 text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/40"
            onClick={onTryAgainProcessing}
          >
            <RefreshCw className="w-4 h-4 mr-2" /> 
            <TranslatableText text="Try Again" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
