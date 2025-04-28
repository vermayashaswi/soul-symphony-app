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
  onDelete: () => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteEntryDialog({ onDelete, isDeleting = false }: DeleteEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleDelete = async () => {
    try {
      setIsProcessing(true);
      await onDelete();
      // Only close the dialog if deletion was successful
      setOpen(false);
    } catch (error) {
      console.error("Error deleting entry:", error);
      // Keep dialog open if there was an error
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button 
          className="hover:text-red-500 text-gray-500" 
          disabled={isDeleting}
        >
          {isDeleting ? (
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
          <AlertDialogCancel disabled={isProcessing}>
            <TranslatableText text="Cancel" />
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete} 
            className="bg-red-500 hover:bg-red-600" 
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
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
