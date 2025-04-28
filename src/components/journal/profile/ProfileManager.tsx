
import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface ProfileManagerProps {
  isCheckingProfile: boolean;
  showRetryButton: boolean;
  onRetryProfileCreation: () => void;
}

export function ProfileManager({ 
  isCheckingProfile, 
  showRetryButton, 
  onRetryProfileCreation 
}: ProfileManagerProps) {
  if (isCheckingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">
            <TranslatableText text="Setting up your profile..." />
          </p>
        </div>
      </div>
    );
  }

  if (showRetryButton) {
    return (
      <div className="mb-6 p-4 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 rounded-lg">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-800 dark:text-amber-200">
              <TranslatableText text="We're having trouble setting up your profile. Your entries may not be saved correctly." />
            </p>
          </div>
          <Button 
            variant="outline" 
            className="w-full sm:w-auto border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
            onClick={onRetryProfileCreation}
          >
            <RefreshCw className="w-4 h-4 mr-2" /> 
            <TranslatableText text="Retry Profile Setup" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
