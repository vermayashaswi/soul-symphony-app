import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/utils/format-time';
import { AlertTriangle, Clock, Trash2 } from 'lucide-react';
import { ThemeBoxes } from './ThemeBoxes';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface JournalEntry {
  id: number;
  "transcription text": string | null;
  "refined text": string | null;
  created_at: string;
  audio_url?: string | null;
  user_id?: string | null;
  "foreign key"?: string | null;
  emotions?: Record<string, number>;
  duration?: number;
  master_themes?: string[];
  sentiment?: string;
  entities?: Array<{ type: string; name: string }>;
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onDelete?: (entryId: number) => void;
}

export function JournalEntryCard({ entry, onDelete }: JournalEntryCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      
      // Delete the entry from the database
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', entry.id);
      
      if (error) throw new Error(error.message);
      
      toast.success('Journal entry deleted successfully');
      
      // Call the onDelete callback to update the UI
      if (onDelete) {
        onDelete(entry.id);
      }
    } catch (error: any) {
      console.error('Error deleting journal entry:', error);
      toast.error('Failed to delete entry: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const transcriptionText = entry["transcription text"] || 'No transcription available';
  const refinedText = entry["refined text"] || 'No refined text available';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg font-semibold">
              {formatRelativeTime(new Date(entry.created_at))}
            </CardTitle>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Journal Entry</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this journal entry? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        
        <CardContent className="py-3">
          <p className="text-sm text-muted-foreground line-clamp-3">
            {refinedText}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
