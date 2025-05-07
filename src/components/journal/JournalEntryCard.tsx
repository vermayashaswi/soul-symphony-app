
import React, { useState, useEffect } from 'react';
import { JournalEntry as JournalEntryType } from '@/types/journal';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '@/hooks/use-theme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FloatingDotsToggle, ThemeLoader, DeleteEntryDialog, EntryContent, EditEntryButton, ExtractThemeButton, LoadingEntryContent } from './entry-card';
import { cn } from '@/lib/utils';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MoreVertical, InfoIcon } from 'lucide-react';

interface JournalEntryCardProps {
  entry: JournalEntryType;
  onDelete?: (entryId: number) => Promise<void>;
  setEntries?: React.Dispatch<React.SetStateAction<JournalEntryType[]>>;
  processing?: boolean;
  processed?: boolean;
  isPlaceholder?: boolean;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = ({ 
  entry, 
  onDelete, 
  setEntries, 
  processing = false,
  processed = false,
  isPlaceholder = false
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { colorTheme } = useTheme();
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(entry.content);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState<string | null>(null);
  const [isExtractingThemes, setIsExtractingThemes] = useState(false);
  const [extractThemesError, setExtractThemesError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const timeAgo = isMounted ? formatDistanceToNow(new Date(entry.created_at), { addSuffix: true }) : 'Loading...';

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
    setLastAction('Toggle Dropdown');
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const openDeleteDialog = () => {
    setShowDeleteDialog(true);
    closeDropdown();
    setLastAction('Open Delete Dialog');
  };

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false);
    setLastAction('Close Delete Dialog');
  };

  const handleDeleteConfirmation = async () => {
    if (!onDelete) {
      console.error("Delete function not provided");
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError(null);
      setLastAction('Deleting Entry');
      await onDelete(entry.id);
      toast.success('Entry successfully deleted', {
        duration: 3000,
        id: 'delete-success-toast',
        closeButton: false
      });
    } catch (error: any) {
      console.error("Error deleting entry:", error);
      setDeleteError(error.message || 'An error occurred while deleting the entry.');
      toast.error('Failed to delete entry');
    } finally {
      setIsDeleting(false);
      closeDeleteDialog();
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setEditedContent(entry.content);
    setLastAction('Start Editing');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setLastAction('Cancel Editing');
  };

  const handleSaveEdit = async () => {
    if (editedContent === entry.content) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      setLastAction('Saving Edit');

      // Optimistically update the UI
      if (setEntries) {
        setEntries(prevEntries =>
          prevEntries.map(e =>
            e.id === entry.id ? { ...e, content: editedContent } : e
          )
        );
      }

      // Dispatch a custom event to notify other components about the update
      window.dispatchEvent(new CustomEvent('journalEntryUpdated', {
        detail: { 
          entryId: entry.id,
          timestamp: Date.now()
        }
      }));

      setIsEditing(false);
      toast.success('Entry successfully updated', {
        duration: 3000,
        id: 'update-success-toast',
        closeButton: false
      });
    } catch (error: any) {
      console.error("Error updating entry:", error);
      setSaveError(error.message || 'An error occurred while updating the entry.');
      toast.error('Failed to update entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReprocessClick = async () => {
    try {
      setIsReprocessing(true);
      setReprocessError(null);
      setLastAction('Reprocessing Entry');

      // Dispatch a custom event to notify other components about the update
      window.dispatchEvent(new CustomEvent('journalEntryUpdated', {
        detail: { 
          entryId: entry.id,
          timestamp: Date.now()
        }
      }));

      toast.success('Entry reprocessing started', {
        duration: 3000,
        id: 'reprocess-success-toast',
        closeButton: false
      });
    } catch (error: any) {
      console.error("Error reprocessing entry:", error);
      setReprocessError(error.message || 'An error occurred while reprocessing the entry.');
      toast.error('Failed to reprocess entry');
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleExtractThemesClick = async () => {
    try {
      setIsExtractingThemes(true);
      setExtractThemesError(null);
      setLastAction('Extracting Themes');

      // Dispatch a custom event to notify other components about the update
      window.dispatchEvent(new CustomEvent('journalEntryUpdated', {
        detail: { 
          entryId: entry.id,
          timestamp: Date.now()
        }
      }));

      toast.success('Theme extraction started', {
        duration: 3000,
        id: 'extract-themes-success-toast',
        closeButton: false
      });
    } catch (error: any) {
      console.error("Error extracting themes:", error);
      setExtractThemesError(error.message || 'An error occurred while extracting themes.');
      toast.error('Failed to extract themes');
    } finally {
      setIsExtractingThemes(false);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
  };

  const cardClasses = cn(
    "rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden transition-all duration-200",
    {
      "opacity-70": processing,
      "ring-2 ring-primary/20": processed && !processing,
      "border-dashed border-primary/40 bg-primary/5": entry.is_placeholder || isPlaceholder
    }
  );

  return (
    <div className={cardClasses} id={`journal-entry-${entry.id}`}>
      {(entry.is_placeholder || isPlaceholder) && (
        <div className="bg-primary/10 px-4 py-1.5 flex items-center gap-2 text-xs text-primary-foreground">
          <InfoIcon size={14} />
          <span><TranslatableText text="Example Entry" /></span>
        </div>
      )}
      
      <div className="flex items-center justify-between px-4 py-2">
        <div className="text-sm text-muted-foreground">
          {timeAgo}
        </div>
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <FloatingDotsToggle onClick={toggleDropdown} pressed={isDropdownOpen} aria-label="Open dropdown menu" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" forceMount className="w-[160px]">
            <DropdownMenuItem onClick={handleEditClick} disabled={processing || isDeleting}>
              <TranslatableText text="Edit Entry" />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleReprocessClick} disabled={processing || isDeleting}>
              <TranslatableText text="Reprocess Entry" />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExtractThemesClick} disabled={processing || isDeleting}>
              <TranslatableText text="Extract Themes" />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openDeleteDialog} disabled={processing || isDeleting}>
              <TranslatableText text="Delete Entry" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <EntryContent entry={entry} isExpanded={isExpanded} entryId={entry.id} />

      <DeleteEntryDialog
        showDeleteDialog={showDeleteDialog}
        closeDeleteDialog={closeDeleteDialog}
        handleDeleteConfirmation={handleDeleteConfirmation}
        isDeleting={isDeleting}
        deleteError={deleteError}
      />
    </div>
  );
};

export default JournalEntryCard;
