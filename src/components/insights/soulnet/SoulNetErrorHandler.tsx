
import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface SoulNetErrorHandlerProps {
  error?: Error | null;
  onRetry?: () => void;
  onTranslationRetry?: () => void;
  showTranslationError?: boolean;
  isLoading?: boolean;
}

export const SoulNetErrorHandler: React.FC<SoulNetErrorHandlerProps> = ({
  error,
  onRetry,
  onTranslationRetry,
  showTranslationError = false,
  isLoading = false
}) => {
  if (showTranslationError) {
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <h2 className="text-xl font-semibold mb-4">
          <TranslatableText 
            text="Soul-Net Visualization" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
          />
        </h2>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <h3 className="font-medium text-yellow-800 dark:text-yellow-300">
              <TranslatableText 
                text="Translations Not Available" 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
              />
            </h3>
          </div>
          <p className="text-yellow-700 dark:text-yellow-400 mb-3">
            <TranslatableText 
              text="The visualization translations are not ready. Please retry to load the translated content." 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </p>
          <Button
            onClick={onTranslationRetry}
            disabled={isLoading}
            className="flex items-center gap-2"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <TranslatableText 
              text="Retry Translations" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-background rounded-xl shadow-sm border w-full p-6">
        <h2 className="text-xl font-semibold text-red-600 mb-4">
          <TranslatableText 
            text="Error Loading Soul-Net" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
          />
        </h2>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <h3 className="font-medium text-red-800 dark:text-red-300">
              <TranslatableText 
                text="Visualization Error" 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
              />
            </h3>
          </div>
          <p className="text-red-700 dark:text-red-400 mb-3 text-sm">
            {error.message}
          </p>
          <div className="space-x-2">
            <Button
              onClick={onRetry}
              disabled={isLoading}
              className="flex items-center gap-2"
              variant="destructive"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <TranslatableText 
                text="Try Again" 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
              />
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
            >
              <TranslatableText 
                text="Reload Page" 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
              />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
