
import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';

export interface EditEntryButtonProps {
  entry: JournalEntry;
  setEntries?: React.Dispatch<React.SetStateAction<JournalEntry[]>> | null;
}

const EditEntryButton: React.FC<EditEntryButtonProps> = ({ entry, setEntries }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editedContent, setEditedContent] = useState(entry.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setEditedContent(entry.content);
    }
    setIsOpen(open);
  };

  const handleSave = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      // Update entry in the database
      const { data, error } = await supabase
        .from('Journal Entries')
        .update({ content: editedContent, Edit_Status: 1 })
        .eq('id', entry.id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update local state
      if (setEntries) {
        setEntries(prev => 
          prev.map(e => e.id === entry.id ? { ...e, content: editedContent } : e)
        );
      }
      
      toast({
        title: "Entry updated",
        description: "Your journal entry has been successfully updated."
      });
      
      setIsOpen(false);
      
    } catch (error) {
      console.error('Error updating journal entry:', error);
      toast({
        title: "Update failed",
        description: "Failed to update your journal entry. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8" 
        onClick={() => setIsOpen(true)}
      >
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </Button>
      
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Journal Entry</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={8}
              className="resize-none"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isSubmitting || editedContent === entry.content}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditEntryButton;
