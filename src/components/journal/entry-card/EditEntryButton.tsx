
import React, { useState } from 'react';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { triggerFullTextProcessing } from '@/utils/audio/theme-extractor';

interface EditEntryButtonProps {
  entryId: number;
  content: string;
  onEntryUpdated: (newContent: string) => void;
}

export function EditEntryButton({ entryId, content, onEntryUpdated }: EditEntryButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const isMobile = useIsMobile();

  const handleOpenDialog = () => {
    setEditedContent(content);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const handleSaveChanges = async () => {
    if (!editedContent.trim() || editedContent === content) {
      handleCloseDialog();
      return;
    }

    try {
      setIsSubmitting(true);
      
      // First, update the text content
      const { error: updateError } = await supabase
        .from('Journal Entries')
        .update({ 
          "refined text": editedContent,
          "Edit_Status": 1,
          // Reset analysis fields to ensure they're reprocessed
          "sentiment": null,
          "emotions": null,
          "master_themes": null,
          "entities": null
        })
        .eq('id', entryId);
        
      if (updateError) {
        console.error("Error updating entry:", updateError);
        toast.error(`Failed to update entry: ${updateError.message}`);
        return;
      }

      // Critical fix: Update parent component with new content BEFORE closing dialog
      // This ensures the UI is updated immediately
      onEntryUpdated(editedContent);
      
      // Close dialog after successful update
      handleCloseDialog();
      
      // Show processing toast
      toast.info('Processing changes...');
      setIsProcessing(true);
      
      // Trigger full text processing in the background
      try {
        // The full processing function handles all AI analysis (themes, sentiment, emotions, entities)
        await triggerFullTextProcessing(entryId);
        console.log("Full text processing triggered successfully");
        toast.success('Journal entry updated and processed');
      } catch (processingError) {
        console.error('Processing failed but entry was updated:', processingError);
        toast.error('Entry saved but analysis failed');
      } finally {
        setIsProcessing(false);
      }
      
    } catch (error) {
      console.error('Error updating journal entry:', error);
      toast.error('Failed to update entry');
    } finally {
      setIsSubmitting(false);
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
            <Button 
              onClick={handleSaveChanges}
              disabled={isSubmitting || !editedContent.trim() || editedContent === content}
              className="rounded-full"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default EditEntryButton;
