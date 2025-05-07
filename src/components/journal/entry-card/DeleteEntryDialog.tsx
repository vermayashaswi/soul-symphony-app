
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
import { toast } from 'sonner';

interface DeleteEntryDialogProps {
  onDelete?: () => Promise<void>;
  isDeleting?: boolean;
  // Add these props to match what's being passed from JournalEntryCard
  showDeleteDialog?: boolean;
  closeDeleteDialog?: () => void;
  handleDeleteConfirmation?: () => Promise<void>;
  deleteError?: string | null;
}

export function DeleteEntryDialog({ 
  onDelete, 
  isDeleting = false,
  showDeleteDialog = false,
  closeDeleteDialog = () => {},
  handleDeleteConfirmation,
  deleteError = null
}: DeleteEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use passed props if available, otherwise use internal state
  const dialogOpen = showDeleteDialog !== undefined ? showDeleteDialog : open;
  const setDialogOpen = closeDeleteDialog ? (value: boolean) => {
    if (!value) closeDeleteDialog();
    setOpen(value);
  } : setOpen;
  
  const handleDelete = async () => {
    if (isProcessing) return;
    
    // If handleDeleteConfirmation was provided, use it instead
    if (handleDeleteConfirmation) {
      return handleDeleteConfirmation();
    }
    
    try {
      setError(null);
      setIsProcessing(true);
      console.log("[DeleteEntryDialog] Starting delete operation");
      
      // Wait for the deletion to complete before proceeding
      if (onDelete) {
        await onDelete();
      }
      
      console.log("[DeleteEntryDialog] Delete operation completed successfully");
      
      // Show success toast
      toast.success("Entry deleted successfully", {
        duration: 3000,
        closeButton: false
      });
      
      // Dispatch an event to notify other components of the deletion
      window.dispatchEvent(new CustomEvent('journalEntriesNeedRefresh', {
        detail: { action: 'delete' }
      }));

      // Only close the dialog after everything is complete
      setTimeout(() => {
        setIsProcessing(false);
        setDialogOpen(false);
      }, 100);
      
    } catch (error) {
      console.error("[DeleteEntryDialog] Error deleting entry:", error);
      
      // Set error state and show toast
      const errorMessage = error instanceof Error ? error.message : "Failed to delete entry";
      setError(errorMessage);
      toast.error(`Error: ${errorMessage}`);
      setIsProcessing(false);
      
      // Keep dialog open if there was an error
    }
  };

  // Use the passed deleteError if available
  const displayError = deleteError || error;

  return (
    <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
          
          {displayError && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200 text-sm">
              {displayError}
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing || isDeleting}>
            <TranslatableText text="Cancel" />
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault(); // Prevent automatic closing of dialog
              handleDelete();
            }} 
            className="bg-red-500 hover:bg-red-600" 
            disabled={isProcessing || isDeleting}
          >
            {isProcessing || isDeleting ? (
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
