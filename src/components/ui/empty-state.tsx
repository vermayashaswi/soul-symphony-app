
import React from 'react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title: React.ReactNode;
  description: React.ReactNode;
  buttonText?: React.ReactNode;
  onAction?: () => void;
  onStartRecording?: () => void; // Add this prop to fix the type error
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  buttonText,
  onAction,
  onStartRecording, // Include the prop in the component parameters
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
