
import React from 'react';
import { Button } from '@/components/ui/button';
import { useTutorial } from '@/contexts/TutorialContext';

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
  const { isActive, isInStep } = useTutorial();
  const isInTutorialStep5 = isActive && isInStep(5);

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>

      {/* Don't show the button during tutorial step 5 */}
      {buttonText && onAction && !isInTutorialStep5 && (
        <Button onClick={onAction}>
          {buttonText}
        </Button>
      )}
    </div>
  );
};
