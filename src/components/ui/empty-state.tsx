
import React from 'react';
import { Button } from '@/components/ui/button';

interface GenericEmptyStateProps {
  title: React.ReactNode;
  description: React.ReactNode;
  buttonText?: React.ReactNode;
  onAction?: () => void;
  onStartRecording?: () => void; // Added this prop
}

// Renamed from EmptyState to GenericEmptyState to avoid confusion
export const GenericEmptyState: React.FC<GenericEmptyStateProps> = ({
  title,
  description,
  buttonText,
  onAction,
  onStartRecording,
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

// For backward compatibility, we'll export the same component as EmptyState
export const EmptyState = GenericEmptyState;
