
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from '@/contexts/TranslationContext';

interface ExitConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ExitConfirmationModal: React.FC<ExitConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const { translate } = useTranslation();

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {translate ? translate("Exit App", "en") : "Exit App"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {translate 
              ? translate("Are you sure you want to exit Soul Symphony? Your progress will be saved.", "en")
              : "Are you sure you want to exit Soul Symphony? Your progress will be saved."
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {translate ? translate("Cancel", "en") : "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {translate ? translate("Exit App", "en") : "Exit App"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ExitConfirmationModal;
