
import React from 'react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title: React.ReactNode;
  description: React.ReactNode;
  buttonText?: React.ReactNode;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  buttonText,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>

      {buttonText && onAction && (
        <Button onClick={onAction}>
          {buttonText}
        </Button>
      )}
    </div>
  );
};
