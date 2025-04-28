
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { Trash, Loader2 } from "lucide-react";
import { TranslatableText } from '@/components/translation/TranslatableText';

interface DeleteEntryDialogProps {
  onDelete: () => void;
  isProcessing?: boolean;
}

export function DeleteEntryDialog({ onDelete, isProcessing = false }: DeleteEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      console.error('Error deleting entry:', error);
    } finally {
      setIsDeleting(false);
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button className="hover:text-red-500 text-gray-500" disabled={isProcessing}>
          {isProcessing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Trash size={16} />
          )}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <TranslatableText text="Delete entry" />
          </AlertDialogTitle>
          <AlertDialogDescription>
            <TranslatableText text="This action cannot be undone. This will permanently delete your journal entry." />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <TranslatableText text="Cancel" />
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete} 
            className="bg-red-500 hover:bg-red-600"
            disabled={isDeleting}
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
