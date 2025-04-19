
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
  onEntryUpdated: (newContent: string, isProcessing?: boolean) => void;
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
      
      // Store current content for potential rollback
      const originalContent = content;
      const newContent = editedContent;
      
      // Close dialog immediately
      setIsDialogOpen(false);
      
      // Set processing state BEFORE updating UI
      setIsProcessing(true);
      
      // Update UI with loading state immediately
      onEntryUpdated(newContent, true);
      
      // Show toast for initial update
      toast.success('Journal entry updated. Analyzing changes...');
      
      // First, update the database entry to mark it for processing
      const { error: updateError } = await supabase
        .from('Journal Entries')
        .update({ 
          "refined text": newContent,
          "Edit_Status": 1,
          "sentiment": "0",
          "emotions": { "Neutral": 0.5 },
          "master_themes": ["Processing"],
          "entities": []
        })
        .eq('id', entryId);
        
      if (updateError) {
        console.error("Error updating entry:", updateError);
        toast.error(`Failed to update entry: ${updateError.message}`);
        
        // Revert UI state on error
        onEntryUpdated(originalContent, false);
        setIsProcessing(false);
        setIsSubmitting(false);
        return;
      }
      
      // Then trigger processing in the background with better error handling
      try {
        await triggerFullTextProcessing(entryId);
        
        // Set a timeout for the analysis to complete before showing final state
        // This helps prevent flickering by maintaining the loading state
        const analysisCompletionTimeout = setTimeout(() => {
          console.log("Analysis completion timeout reached, finalizing UI state");
          onEntryUpdated(newContent, false);
          setIsProcessing(false);
          toast.success('Journal entry analysis completed');
        }, 8000); // Give analysis up to 8 seconds to complete
        
        // Set up polling to check for completed analysis
        let pollingAttempts = 0;
        const maxPollingAttempts = 10;
        const pollingInterval = setInterval(async () => {
          pollingAttempts++;
          console.log(`Polling for analysis completion (attempt ${pollingAttempts})`);
          
          try {
            const { data, error } = await supabase
              .from('Journal Entries')
              .select('master_themes, emotions, sentiment')
              .eq('id', entryId)
              .single();
              
            if (error) {
              console.error("Error checking analysis status:", error);
              return;
            }
            
            // Check if analysis is likely complete by looking for real analysis data
            const hasRealThemes = data.master_themes && 
                                 Array.isArray(data.master_themes) && 
                                 data.master_themes.length > 0 && 
                                 !data.master_themes.includes("Processing");
                                 
            const hasEmotions = data.emotions && 
                               Object.keys(data.emotions).length > 0 && 
                               !Object.keys(data.emotions).includes("Neutral");
                               
            if (hasRealThemes || hasEmotions) {
              // Analysis appears complete, update UI and clear polling
              clearTimeout(analysisCompletionTimeout);
              clearInterval(pollingInterval);
              
              console.log("Analysis complete, updating UI with final state");
              onEntryUpdated(newContent, false);
              setIsProcessing(false);
              toast.success('Journal entry analysis completed');
            } else if (pollingAttempts >= maxPollingAttempts) {
              // Give up polling after max attempts
              clearInterval(pollingInterval);
              console.log("Reached max polling attempts, finalizing UI state");
              onEntryUpdated(newContent, false);
              setIsProcessing(false);
            }
          } catch (pollError) {
            console.error("Polling error:", pollError);
          }
        }, 1000); // Check every second
        
      } catch (processingError) {
        console.error('Processing failed:', processingError);
        toast.error('Entry saved but analysis failed');
        
        // Ensure we clean up UI state even on error
        onEntryUpdated(newContent, false);
        setIsProcessing(false);
      }
      
    } catch (error) {
      console.error('Error updating journal entry:', error);
      toast.error('Failed to update entry');
    } finally {
      // Ensure submission state is reset
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
