
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
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
import { TranslatableText } from '@/components/translation/TranslatableText';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { deleteAllUserJournalEntries } from '@/services/journalService';

export const DeleteAllEntriesSection: React.FC = () => {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleDeleteAllEntries = async () => {
    if (!user?.id) {
      toast.error(<TranslatableText text="User not found" forceTranslate={true} />);
      return;
    }

    try {
      setIsDeleting(true);
      
      const result = await deleteAllUserJournalEntries(user.id);
      
      if (result.success) {
        toast.success(
          <TranslatableText 
            text={`Successfully deleted ${result.deletedEntries} journal entries`} 
            forceTranslate={true} 
          />
        );
        
        // Dispatch event to refresh journal entries in other components
        window.dispatchEvent(new CustomEvent('journalEntriesDeleted', {
          detail: { deletedCount: result.deletedEntries }
        }));
        
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Error deleting all entries:', error);
      toast.error(
        <TranslatableText 
          text="Failed to delete entries. Please try again." 
          forceTranslate={true} 
        />
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-red-800 dark:text-red-200 mb-1">
            <TranslatableText text="Danger Zone" />
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
            <TranslatableText text="This action will permanently delete all your journal entries. This cannot be undone." />
          </p>
          
          <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                <TranslatableText text="Delete All Entries" />
              </Button>
            </AlertDialogTrigger>
            
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <TranslatableText text="Delete All Journal Entries?" />
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    <TranslatableText text="This will permanently delete ALL of your journal entries and their associated data." />
                  </p>
                  <p className="font-medium text-red-600">
                    <TranslatableText text="This action cannot be undone." />
                  </p>
                  <p>
                    <TranslatableText text="Are you sure you want to continue?" />
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>
                  <TranslatableText text="Cancel" />
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAllEntries}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      <TranslatableText text="Deleting..." />
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      <TranslatableText text="Yes, Delete All" />
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};
