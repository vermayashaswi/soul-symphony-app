import React, { useState, useEffect } from 'react';
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
  const [translations, setTranslations] = useState({
    title: "Exit App",
    description: "Are you sure you want to exit Soul Symphony? Your progress will be saved.",
    cancel: "Cancel",
    exit: "Exit App"
  });

  useEffect(() => {
    const loadTranslations = async () => {
      if (!translate) return;

      try {
        const [title, description, cancel, exit] = await Promise.all([
          translate("Exit App", "en"),
          translate("Are you sure you want to exit Soul Symphony? Your progress will be saved.", "en"),
          translate("Cancel", "en"),
          translate("Exit App", "en")
        ]);

        setTranslations({
          title: title || "Exit App",
          description: description || "Are you sure you want to exit Soul Symphony? Your progress will be saved.",
          cancel: cancel || "Cancel",
          exit: exit || "Exit App"
        });
      } catch (error) {
        console.error('Error loading translations for exit modal:', error);
        // Keep default English text if translation fails
      }
    };

    if (isOpen) {
      loadTranslations();
    }
  }, [isOpen, translate]);

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {translations.title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {translations.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {translations.cancel}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {translations.exit}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ExitConfirmationModal;
