
import React from 'react';
import { Loader2 } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface LoadingIndicatorProps {
  show: boolean;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ show }) => {
  if (!show) {
    return null;
  }
  
  return (
    <div className="flex items-center justify-center h-16 mt-4">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
};

export const InitialLoadingState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
      <p className="text-muted-foreground"><TranslatableText text="Loading your journal entries..." /></p>
    </div>
  );
};
