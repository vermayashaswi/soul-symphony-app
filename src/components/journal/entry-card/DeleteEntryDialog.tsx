
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
import { Loader2 } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface DeleteEntryDialogProps {
  showDeleteDialog: boolean;
  closeDeleteDialog: () => void;
  handleDeleteConfirmation: () => void;
  isDeleting: boolean;
  deleteError: string | null;
}

export function DeleteEntryDialog({
  showDeleteDialog,
  closeDeleteDialog,
  handleDeleteConfirmation,
  isDeleting,
  deleteError
}: DeleteEntryDialogProps) {
  return (
    <AlertDialog open={showDeleteDialog} onOpenChange={closeDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <TranslatableText text="Delete Journal Entry" />
          </AlertDialogTitle>
          <AlertDialogDescription>
            <TranslatableText text="Are you sure you want to delete this journal entry? This action cannot be undone." />
          </AlertDialogDescription>
          {deleteError && (
            <p className="text-red-500 text-sm mt-2">{deleteError}</p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            <TranslatableText text="Cancel" />
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDeleteConfirmation();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <TranslatableText text="Deleting..." />
              </>
            ) : (
              <TranslatableText text="Delete" />
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteEntryDialog;
