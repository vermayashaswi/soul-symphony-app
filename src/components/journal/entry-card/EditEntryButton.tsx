
import React, { useState } from 'react';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2 } from 'lucide-react';
import { reprocessJournalEntry } from '@/services/journalService';

export interface EditEntryButtonProps {
  entryId: number;
  content: string;
  onEntryUpdated: (newContent: string, isProcessing?: boolean) => void;
}

export function EditEntryButton({ entryId, content, onEntryUpdated }: EditEntryButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [updatedInBackground, setUpdatedInBackground] = useState(false);
  const isMobile = useIsMobile();

  const handleOpenDialog = () => {
    setEditedContent(content);
    setIsDialogOpen(true);
    setUpdatedInBackground(false);
  };

  const handleCloseDialog = () => {
    if (!isSubmitting) {
      setIsDialogOpen(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!editedContent.trim() || editedContent === content) {
      handleCloseDialog();
      return;
    }

    try {
      setIsSubmitting(true);
      
      const originalContent = content;
      const newContent = editedContent;
      
      // Update UI with processing state IMMEDIATELY but keep dialog open
      onEntryUpdated(newContent, true);
      setIsProcessing(true);
      
      const { error: updateError } = await supabase
        .from('Journal Entries')
        .update({ 
          "refined text": newContent,
          "transcription text": newContent, // Also update the transcription text to ensure we see the difference
          "Edit_Status": 1
        })
        .eq('id', entryId);
        
      if (updateError) {
        console.error("Error updating entry:", updateError);
        toast.error(`Failed to update entry: ${updateError.message}`);
        onEntryUpdated(originalContent, false);
        setIsProcessing(false);
        setIsSubmitting(false);
        return;
      }

      // Set updated flag and keep dialog open briefly
      setUpdatedInBackground(true);
      
      try {
        // Use the reprocessJournalEntry function to trigger all necessary processing
        const success = await reprocessJournalEntry(entryId);
        
        if (!success) {
          console.error('Reprocessing failed for entry:', entryId);
          toast.error('Entry saved but analysis failed');
        }
        
        // Ensure minimum processing time for UX consistency
        const minProcessingTime = 1000; // 1 second minimum
        await new Promise(resolve => setTimeout(resolve, minProcessingTime));
        
        // Close dialog and update UI
        setIsDialogOpen(false);
        setIsSubmitting(false);
        setIsProcessing(false);
        toast.success('Journal entry updated successfully');
        
      } catch (processingError) {
        console.error('Processing failed:', processingError);
        toast.error('Entry saved but analysis failed');
        setIsDialogOpen(false);
        setIsSubmitting(false);
        setIsProcessing(false);
      }
      
    } catch (error) {
      console.error('Error updating journal entry:', error);
      toast.error('Failed to update entry');
      setIsSubmitting(false);
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Button 
        variant="ghost" 
        size={isMobile ? "sm" : "icon"} 
        className={isMobile ? "h-8 w-8 p-0 rounded-full" : "rounded-full"}
        onClick={handleOpenDialog}
        aria-label="Edit entry"
        disabled={isProcessing}
      >
        <Edit className="h-4 w-4" />
      </Button>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[90%] max-w-lg mx-auto">
          <DialogHeader>
            <DialogTitle>Edit Journal Entry</DialogTitle>
          </DialogHeader>
          
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[200px] mt-2"
            placeholder="Edit your journal entry..."
            disabled={isSubmitting}
          />
          
          <DialogFooter className="flex flex-row justify-end space-x-2 mt-4">
            <Button 
              variant="outline" 
              onClick={handleCloseDialog}
              disabled={isSubmitting}
              className="rounded-full"
            >
              Cancel
            </Button>
            {isSubmitting ? (
              <Button 
                disabled
                className="rounded-full"
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {updatedInBackground ? 'Processing...' : 'Saving...'}
              </Button>
            ) : (
              <Button 
                onClick={handleSaveChanges}
                disabled={!editedContent.trim() || editedContent === content}
                className="rounded-full"
              >
                Save Changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default EditEntryButton;
