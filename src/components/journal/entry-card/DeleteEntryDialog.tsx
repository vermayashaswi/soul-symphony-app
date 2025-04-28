
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
import { Trash } from "lucide-react";
import { TranslatableText } from '@/components/translation/TranslatableText';

interface DeleteEntryDialogProps {
  onDelete: () => void;
}

export function DeleteEntryDialog({ onDelete }: DeleteEntryDialogProps) {
  const [open, setOpen] = useState(false);
  
  const handleDelete = () => {
    onDelete();
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button className="hover:text-red-500 text-gray-500">
          <Trash size={16} />
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
          <AlertDialogCancel>
            <TranslatableText text="Cancel" />
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
            <TranslatableText text="Delete" />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteEntryDialog;
