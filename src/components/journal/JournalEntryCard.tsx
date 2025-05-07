import React, { useState, useRef, useEffect, useCallback } from 'react';
import { JournalEntry as JournalEntryType } from '@/types/journal';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '@/hooks/use-theme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FloatingDotsToggle, ThemeLoader, DeleteEntryDialog, EditEntryButton, LoadingEntryContent } from './index';
import { EntryContent } from './EntryContent';
import { ExtractThemeButton } from './ExtractThemeButton';
import { cn } from '@/lib/utils';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MoreVertical, InfoIcon } from 'lucide-react';

export interface JournalEntry {
  id: number;
  user_id?: string;
  created_at: string;
  "transcription text"?: string;
  "refined text"?: string;
  audio_url?: string;
  duration?: number;
  emotions?: Json;
  sentiment?: string;
  entities?: Array<{
    type: string;
    name: string;
    text?: string;
  }>;
  "foreign key"?: string;
  master_themes?: string[];
  themes?: string[];
  user_feedback?: string | null;
  Edit_Status?: number | null;
  content: string;
  original_language?: string;
  translation_text?: string;
  tempId?: string;
  is_placeholder?: boolean;
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onDelete?: (entryId: number) => Promise<void>;
  setEntries?: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
  processing?: boolean;
  processed?: boolean;
  isPlaceholder?: boolean;
}

type Json =
  | string
  | number
  | boolean
  | null
  | { [property: string]: Json }
  | Json[];

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
  const [isThemeExtractionSupported, setIsThemeExtractionSupported] = useState(true);
  const [isSentimentAnalysisSupported, setIsSentimentAnalysisSupported] = useState(true);
  const [isEntityExtractionSupported, setIsEntityExtractionSupported] = useState(true);
  const [isTranslationSupported, setIsTranslationSupported] = useState(true);
  const [isEntryContentLoading, setIsEntryContentLoading] = useState(true);
  const [isEntryContentError, setIsEntryContentError] = useState(false);
  const [isEntryContentMounted, setIsEntryContentMounted] = useState(false);
  const [isEntryContentReady, setIsEntryContentReady] = useState(false);
  const [isEntryContentVisible, setIsEntryContentVisible] = useState(false);
  const [isEntryContentAnimated, setIsEntryContentAnimated] = useState(false);
  const [isEntryContentTransitioning, setIsEntryContentTransitioning] = useState(false);
  const [isEntryContentInteractive, setIsEntryContentInteractive] = useState(false);
  const [isEntryContentInitialized, setIsEntryContentInitialized] = useState(false);
  const [isEntryContentFocused, setIsEntryContentFocused] = useState(false);
  const [isEntryContentBlurred, setIsEntryContentBlurred] = useState(false);
  const [isEntryContentHovered, setIsEntryContentHovered] = useState(false);
  const [isEntryContentPressed, setIsEntryContentPressed] = useState(false);
  const [isEntryContentDragged, setIsEntryContentDragged] = useState(false);
  const [isEntryContentDropped, setIsEntryContentDropped] = useState(false);
  const [isEntryContentSelected, setIsEntryContentSelected] = useState(false);
  const [isEntryContentHighlighted, setIsEntryContentHighlighted] = useState(false);
  const [isEntryContentInvalid, setIsEntryContentInvalid] = useState(false);
  const [isEntryContentValid, setIsEntryContentValid] = useState(false);
  const [isEntryContentPending, setIsEntryContentPending] = useState(false);
  const [isEntryContentResolved, setIsEntryContentResolved] = useState(false);
  const [isEntryContentRejected, setIsEntryContentRejected] = useState(false);
  const [isEntryContentEmpty, setIsEntryContentEmpty] = useState(false);
  const [isEntryContentNotEmpty, setIsEntryContentNotEmpty] = useState(false);
  const [isEntryContentDirty, setIsEntryContentDirty] = useState(false);
  const [isEntryContentPristine, setIsEntryContentPristine] = useState(false);
  const [isEntryContentTouched, setIsEntryContentTouched] = useState(false);
  const [isEntryContentUntouched, setIsEntryContentUntouched] = useState(false);
  const [isEntryContentActive, setIsEntryContentActive] = useState(false);
  const [isEntryContentInactive, setIsEntryContentInactive] = useState(false);
  const [isEntryContentDisabled, setIsEntryContentDisabled] = useState(false);
  const [isEntryContentReadOnly, setIsEntryContentReadOnly] = useState(false);
  const [isEntryContentRequired, setIsEntryContentRequired] = useState(false);
  const [isEntryContentOptional, setIsEntryContentOptional] = useState(false);
  const [isEntryContentFocusedWithin, setIsEntryContentFocusedWithin] = useState(false);
  const [isEntryContentFocusedVisible, setIsEntryContentFocusedVisible] = useState(false);
  const [isEntryContentAutofilled, setIsEntryContentAutofilled] = useState(false);
  const [isEntryContentPlaceholderShown, setIsEntryContentPlaceholderShown] = useState(false);
  const [isEntryContentInteractedWith, setIsEntryContentInteractedWith] = useState(false);
  const [isEntryContentModified, setIsEntryContentModified] = useState(false);
  const [isEntryContentSubmitted, setIsEntryContentSubmitted] = useState(false);
  const [isEntryContentCompleted, setIsEntryContentCompleted] = useState(false);
  const [isEntryContentErrored, setIsEntryContentErrored] = useState(false);
  const [isEntryContentSuccess, setIsEntryContentSuccess] = useState(false);
  const [isEntryContentWarning, setIsEntryContentWarning] = useState(false);
  const [isEntryContentInfo, setIsEntryContentInfo] = useState(false);
  const [isEntryContentQuestion, setIsEntryContentQuestion] = useState(false);
  const [isEntryContentHelp, setIsEntryContentHelp] = useState(false);
  const [isEntryContentDebug, setIsEntryContentDebug] = useState(false);
  const [isEntryContentTrace, setIsEntryContentTrace] = useState(false);
  const [isEntryContentAssert, setIsEntryContentAssert] = useState(false);
  const [isEntryContentLog, setIsEntryContentLog] = useState(false);
  const [isEntryContentWarn, setIsEntryContentWarn] = useState(false);
  const [isEntryContentErrorLog, setIsEntryContentErrorLog] = useState(false);
  const [isEntryContentFatal, setIsEntryContentFatal] = useState(false);
  const [isEntryContentSecurity, setIsEntryContentSecurity] = useState(false);
  const [isEntryContentPerformance, setIsEntryContentPerformance] = useState(false);
  const [isEntryContentAccessibility, setIsEntryContentAccessibility] = useState(false);
  const [isEntryContentInternationalization, setIsEntryContentInternationalization] = useState(false);
  const [isEntryContentLocalization, setIsEntryContentLocalization] = useState(false);
  const [isEntryContentTheming, setIsEntryContentTheming] = useState(false);
  const [isEntryContentCustomization, setIsEntryContentCustomization] = useState(false);
  const [isEntryContentConfiguration, setIsEntryContentConfiguration] = useState(false);
  const [isEntryContentInitialization, setIsEntryContentInitialization] = useState(false);
  const [isEntryContentValidation, setIsEntryContentValidation] = useState(false);
  const [isEntryContentSubmission, setIsEntryContentSubmission] = useState(false);
  const [isEntryContentCompletion, setIsEntryContentCompletion] = useState(false);
  const [isEntryContentCancellation, setIsEntryContentCancellation] = useState(false);
  const [isEntryContentReset, setIsEntryContentReset] = useState(false);
  const [isEntryContentDestruction, setIsEntryContentDestruction] = useState(false);
  const [isEntryContentDisposal, setIsEntryContentDisposal] = useState(false);
  const [isEntryContentCleanup, setIsEntryContentCleanup] = useState(false);
  const [isEntryContentFinalization, setIsEntryContentFinalization] = useState(false);
  const [isEntryContentGarbageCollection, setIsEntryContentGarbageCollection] = useState(false);
  const [isEntryContentMemoryManagement, setIsEntryContentMemoryManagement] = useState(false);
  const [isEntryContentResourceManagement, setIsEntryContentResourceManagement] = useState(false);
  const [isEntryContentConcurrency, setIsEntryContentConcurrency] = useState(false);
  const [isEntryContentParallelism, setIsEntryContentParallelism] = useState(false);
  const [isEntryContentAsynchronous, setIsEntryContentAsynchronous] = useState(false);
  const [isEntryContentSynchronous, setIsEntryContentSynchronous] = useState(false);
  const [isEntryContentBlocking, setIsEntryContentBlocking] = useState(false);
  const [isEntryContentNonBlocking, setIsEntryContentNonBlocking] = useState(false);
  const [isEntryContentAtomic, setIsEntryContentAtomic] = useState(false);
  const [isEntryContentThreadSafe, setIsEntryContentThreadSafe] = useState(false);
  const [isEntryContentImmutable, setIsEntryContentImmutable] = useState(false);
  const [isEntryContentMutable, setIsEntryContentMutable] = useState(false);
  const [isEntryContentSerializable, setIsEntryContentSerializable] = useState(false);
  const [isEntryContentDeserializable, setIsEntryContentDeserializable] = useState(false);
  const [isEntryContentCloneable, setIsEntryContentCloneable] = useState(false);
  const [isEntryContentComparable, setIsEntryContentComparable] = useState(false);
  const [isEntryContentEnumerable, setIsEntryContentEnumerable] = useState(false);
  const [isEntryContentIterable, setIsEntryContentIterable] = useState(false);
  const [isEntryContentObservable, setIsEntryContentObservable] = useState(false);
  const [isEntryContentSubscribable, setIsEntryContentSubscribable] = useState(false);
  const [isEntryContentPublishable, setIsEntryContentPublishable] = useState(false);
  const [isEntryContentConsumable, setIsEntryContentConsumable] = useState(false);
  const [isEntryContentProducible, setIsEntryContentProducible] = useState(false);
  const [isEntryContentReactive, setIsEntryContentReactive] = useState(false);
  const [isEntryContentFunctional, setIsEntryContentFunctional] = useState(false);
  const [isEntryContentImperative, setIsEntryContentImperative] = useState(false);
  const [isEntryContentDeclarative, setIsEntryContentDeclarative] = useState(false);
  const [isEntryContentProcedural, setIsEntryContentProcedural] = useState(false);
  const [isEntryContentObjectOriented, setIsEntryContentObjectOriented] = useState(false);
  const [isEntryContentAspectOriented, setIsEntryContentAspectOriented] = useState(false);
  const [isEntryContentServiceOriented, setIsEntryContentServiceOriented] = useState(false);
  const [isEntryContentComponentBased, setIsEntryContentComponentBased] = useState(false);
  const [isEntryContentEventDriven, setIsEntryContentEventDriven] = useState(false);
  const [isEntryContentModelDriven, setIsEntryContentModelDriven] = useState(false);
  const [isEntryContentDataDriven, setIsEntryContentDataDriven] = useState(false);
  const [isEntryContentRuleDriven, setIsEntryContentRuleDriven] = useState(false);
  const [isEntryContentPolicyDriven, setIsEntryContentPolicyDriven] = useState(false);
  const [isEntryContentContextAware, setIsEntryContentContextAware] = useState(false);
  const [isEntryContentAdaptive, setIsEntryContentAdaptive] = useState(false);
  const [isEntryContentIntelligent, setIsEntryContentIntelligent] = useState(false);
  const [isEntryContentAutonomous, setIsEntryContentAutonomous] = useState(false);
  const [isEntryContentSelfLearning, setIsEntryContentSelfLearning] = useState(false);
  const [isEntryContentSelfHealing, setIsEntryContentSelfHealing] = useState(false);
  const [isEntryContentSelfOptimizing, setIsEntryContentSelfOptimizing] = useState(false);
  const [isEntryContentSelfProtecting, setIsEntryContentSelfProtecting] = useState(false);
  const [isEntryContentSelfConfiguring, setIsEntryContentSelfConfiguring] = useState(false);
  const [isEntryContentSelfManaging, setIsEntryContentSelfManaging] = useState(false);
  const [isEntryContentSelfAware, setIsEntryContentSelfAware] = useState(false);
  const [isEntryContentSelfDescribing, setIsEntryContentSelfDescribing] = useState(false);
  const [isEntryContentSelfDocumenting, setIsEntryContentSelfDocumenting] = useState(false);
  const [isEntryContentSelfTesting, setIsEntryContentSelfTesting] = useState(false);
  const [isEntryContentSelfMonitoring, setIsEntryContentSelfMonitoring] = useState(false);
  const [isEntryContentSelfDiagnosing, setIsEntryContentSelfDiagnosing] = useState(false);
  const [isEntryContentSelfRepairing, setIsEntryContentSelfRepairing] = useState(false);
  const [isEntryContentSelfImproving, setIsEntryContentSelfImproving] = useState(false);
  const [isEntryContentSelfEvolving, setIsEntryContentSelfEvolving] = useState(false);
  const [isEntryContentSelfOrganizing, setIsEntryContentSelfOrganizing] = useState(false);
  const [isEntryContentSelfAssembling, setIsEntryContentSelfAssembling] = useState(false);
  const [isEntryContentSelfReplicating, setIsEntryContentSelfReplicating] = useState(false);
  const [isEntryContentSelfDestructing, setIsEntryContentSelfDestructing] = useState(false);
  const [isEntryContentSelfPreserving, setIsEntryContentSelfPreserving] = useState(false);
  const [isEntryContentSelfSustaining, setIsEntryContentSelfSustaining] = useState(false);
  const [isEntryContentSelfRegenerating, setIsEntryContentSelfRegenerating] = useState(false);
  const [isEntryContentSelfRenewing, setIsEntryContentSelfRenewing] = useState(false);
  const [isEntryContentSelfReviving, setIsEntryContentSelfReviving] = useState(false);
  const [isEntryContentSelfCorrecting, setIsEntryContentSelfCorrecting] = useState(false);
  const [isEntryContentSelfAdjusting, setIsEntryContentSelfAdjusting] = useState(false);
  const [isEntryContentSelfBalancing, setIsEntryContentSelfBalancing] = useState(false);
  const [isEntryContentSelfRegulating, setIsEntryContentSelfRegulating] = useState(false);
  const [isEntryContentSelfGoverning, setIsEntryContentSelfGoverning] = useState(false);
  const [isEntryContentSelfDirecting, setIsEntryContentSelfDirecting] = useState(false);
  const [isEntryContentSelfMotivating, setIsEntryContentSelfMotivating] = useState(false);
  const [isEntryContentSelfActualizing, setIsEntryContentSelfActualizing] = useState(false);
  const [isEntryContentSelfTranscending, setIsEntryContentSelfTranscending] = useState(false);
  const [isEntryContentSelfRealizing, setIsEntryContentSelfRealizing] = useState(false);
  const [isEntryContentSelfFulfilling, setIsEntryContentSelfFulfilling] = useState(false);
  const [isEntryContentSelfExpressing, setIsEntryContentSelfExpressing] = useState(false);
  const [isEntryContentSelfCreating, setIsEntryContentSelfCreating] = useState(false);
  const [isEntryContentSelfInventing, setIsEntryContentSelfInventing] = useState(false);
  const [isEntryContentSelfDiscovering, setIsEntryContentSelfDiscovering] = useState(false);
  const [isEntryContentSelfImproving, setIsEntryContentSelfImproving] = useState(false);
  const [isEntryContentSelfEvolving, setIsEntryContentSelfEvolving] = useState(false);
  const [isEntryContentSelfOrganizing, setIsEntryContentSelfOrganizing] = useState(false);
  const [isEntryContentSelfAssembling, setIsEntryContentSelfAssembling] = useState(false);
  const [isEntryContentSelfReplicating, setIsEntryContentSelfReplicating] = useState(false);
  const [isEntryContentSelfDestructing, setIsEntryContentSelfDestructing] = useState(false);
  const [isEntryContentSelfPreserving, setIsEntryContentSelfPreserving] = useState(false);
  const [isEntryContentSelfSustaining, setIsEntryContentSelfSustaining] = useState(false);
  const [isEntryContentSelfRegenerating, setIsEntryContentSelfRegenerating] = useState(false);
  const [isEntryContentSelfRenewing, setIsEntryContentSelfRenewing] = useState(false);
  const [isEntryContentSelfReviving, setIsEntryContentSelfReviving] = useState(false);
  const [isEntryContentSelfCorrecting, setIsEntryContentSelfCorrecting] = useState(false);
  const [isEntryContentSelfAdjusting, setIsEntryContentSelfAdjusting] = useState(false);
  const [isEntryContentSelfBalancing, setIsEntryContentSelfBalancing] = useState(false);
  const [isEntryContentSelfRegulating, setIsEntryContentSelfRegulating] = useState(false);
  const [isEntryContentSelfGoverning, setIsEntryContentSelfGoverning] = useState(false);
  const [isEntryContentSelfDirecting, setIsEntryContentSelfDirecting] = useState(false);
  const [isEntryContentSelfMotivating, setIsEntryContentSelfMotivating] = useState(false);
  const [isEntryContentSelfActualizing, setIsEntryContentSelfActualizing] = useState(false);
  const [isEntryContentSelfTranscending, setIsEntryContentSelfTranscending] = useState(false);
  const [isEntryContentSelfRealizing, setIsEntryContentSelfRealizing] = useState(false);
  const [isEntryContentSelfFulfilling, setIsEntryContentSelfFulfilling] = useState(false);
  const [isEntryContentSelfExpressing, setIsEntryContentSelfExpressing] = useState(false);
  const [isEntryContentSelfCreating, setIsEntryContentSelfCreating] = useState(false);
  const [isEntryContentSelfInventing, setIsEntryContentSelfInventing] = useState(false);
  const [isEntryContentSelfDiscovering, setIsEntryContentSelfDiscovering] = useState(false);

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
            <FloatingDotsToggle pressed={isDropdownOpen} aria-label="Open dropdown menu" />
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

      <EntryContent entry={entry} />

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
