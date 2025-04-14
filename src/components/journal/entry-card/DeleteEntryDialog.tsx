
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, ThumbsUp, ThumbsDown } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
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

  useEffect(() => {
    return () => {
      componentMounted.current = false;
    };
  }, []);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
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

  const handleUserFeedback = async (feedback: number) => {
    if (!entryId) return;

    try {
      const { error } = await supabase
        .from('Journal Entries')
        .update({ user_feedback: feedback })
        .eq('id', entryId);
    
      if (error) {
        console.error('Error saving user feedback:', error);
        toast.error('Failed to save feedback');
      } else {
        toast.success('Thank you for your feedback!');
      }
    } catch (error) {
      console.error('Unexpected error saving feedback:', error);
      toast.error('An unexpected error occurred');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size={isMobile ? "sm" : "icon"} className={isMobile ? "h-8 w-8 p-0" : ""}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>Are you absolutely sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your journal entry from our
            servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => handleUserFeedback(1)}
                className="flex items-center"
              >
                <ThumbsUp className="mr-2 h-4 w-4" /> 
                Good Translation
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleUserFeedback(0)}
                className="flex items-center"
              >
                <ThumbsDown className="mr-2 h-4 w-4" /> 
                Needs Improvement
              </Button>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isDeleting}>
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteEntryDialog;
