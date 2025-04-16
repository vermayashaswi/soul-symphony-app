
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

interface DeleteEntryDialogProps {
  entryId?: number;
  onDelete: () => Promise<void>;
}

export function DeleteEntryDialog({ entryId, onDelete }: DeleteEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMobile = useIsMobile();
  const componentMounted = useRef(true);
  const deleteAttempted = useRef(false);

  useEffect(() => {
    return () => {
      componentMounted.current = false;
    };
  }, []);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      deleteAttempted.current = true;
      
      // First close the dialog to prevent further user interactions
      setOpen(false);
      
      // Call the delete handler
      await onDelete();
    } catch (error) {
      console.error('[DeleteEntryDialog] Error deleting entry:', error);
      // Only update state if component is still mounted
      if (componentMounted.current) {
        setIsDeleting(false);
      }
    }
  };

  // Handle dialog close without deletion
  const handleDialogChange = (newOpenState: boolean) => {
    // Only update if there's a change
    if (open !== newOpenState) {
      // If closing without deletion attempt, reset states
      if (!newOpenState && !deleteAttempted.current && isDeleting === false) {
        console.log('[DeleteEntryDialog] Dialog closed without deletion');
      }
      // Always update the open state
      setOpen(newOpenState);
      
      // Reset the delete attempted flag when dialog opens
      if (newOpenState) {
        deleteAttempted.current = false;
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size={isMobile ? "sm" : "icon"} className={isMobile ? "h-8 w-8 p-0" : ""}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] w-[calc(100%-2rem)] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your journal entry from our
            servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex space-x-2">
          <Button type="button" variant="secondary" onClick={() => handleDialogChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteEntryDialog;
