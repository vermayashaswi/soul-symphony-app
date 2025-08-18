
import React, { useState, useEffect } from 'react';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { reprocessJournalEntry } from '@/services/journalService';
import { useTranslation } from '@/contexts/TranslationContext';
import { showTranslatedToast } from '@/services/notificationService';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { EnhancedTranslatableText } from '@/components/translation/EnhancedTranslatableText';
import { cn } from '@/lib/utils';

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
  const [updatedInBackground, setUpdatedInBackground] = useState(false);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [isTranslatingForSave, setIsTranslatingForSave] = useState(false);
  const isMobile = useIsMobile();
  const { currentLanguage, translate, getCachedTranslation } = useTranslation();

  // Function to get the appropriate content for editing
  const getContentForEditing = async (originalContent: string): Promise<string> => {
    // If current language is English, use the original content
    if (currentLanguage === 'en') {
      return originalContent;
    }

    // Check if we have a cached translation first
    const cachedTranslation = getCachedTranslation(originalContent);
    if (cachedTranslation) {
      console.log('[EditEntryButton] Using cached translation for editing');
      return cachedTranslation;
    }

    // If no cache, translate the content
    try {
      setIsLoadingTranslation(true);
      console.log('[EditEntryButton] Translating content for editing to', currentLanguage);
      const translatedContent = await translate(originalContent, 'en', entryId);
      return translatedContent || originalContent;
    } catch (error) {
      console.error('[EditEntryButton] Error translating content for editing:', error);
      return originalContent;
    } finally {
      setIsLoadingTranslation(false);
    }
  };

  // Function to translate edited content back to English for database storage
  const translateToEnglishForSave = async (editedText: string): Promise<string> => {
    if (currentLanguage === 'en') {
      return editedText;
    }

    try {
      setIsTranslatingForSave(true);
      console.log('[EditEntryButton] Translating edited content back to English for database storage');
      
      // Use Supabase edge function to translate back to English
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text: editedText,
          sourceLanguage: currentLanguage,
          targetLanguage: 'en',
          cleanResult: true
        }
      });

      if (error) {
        console.error('[EditEntryButton] Error translating to English:', error);
        throw new Error('Translation to English failed');
      }

      if (data && data.translatedText) {
        console.log('[EditEntryButton] Successfully translated to English for storage');
        return data.translatedText;
      }

      throw new Error('No translated text returned');
    } catch (error) {
      console.error('[EditEntryButton] Error in translateToEnglishForSave:', error);
      throw error;
    } finally {
      setIsTranslatingForSave(false);
    }
  };

  const handleOpenDialog = async () => {
    setIsDialogOpen(true);
    setUpdatedInBackground(false);
    
    // Get the appropriate content for editing based on current language
    const contentForEditing = await getContentForEditing(content);
    setEditedContent(contentForEditing);
  };

  const handleCloseDialog = () => {
    if (!isSubmitting) {
      setIsDialogOpen(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!editedContent.trim()) {
      handleCloseDialog();
      return;
    }

    try {
      setIsSubmitting(true);
      
      let contentToSave = editedContent;
      
      // If editing in a non-English language, translate back to English for database storage
      if (currentLanguage !== 'en') {
        try {
          contentToSave = await translateToEnglishForSave(editedContent);
          console.log('[EditEntryButton] Translated content for database storage:', {
            original: editedContent.substring(0, 50) + '...',
            translated: contentToSave.substring(0, 50) + '...'
          });
        } catch (translationError) {
          console.error('[EditEntryButton] Failed to translate to English, using original content:', translationError);
          await showTranslatedToast(
            'toasts.error',
            'toasts.translationFailed',
            translate
          );
          setIsSubmitting(false);
          return;
        }
        
        // Cache the edited translation for consistency in the UI
        const { translationCache } = await import('@/services/translationCache');
        await translationCache.setTranslation({
          originalText: contentToSave, // Store the English version as original
          translatedText: editedContent, // Store the edited version as translation
          language: currentLanguage,
          timestamp: Date.now(),
          version: 1,
        });
        
        console.log('[EditEntryButton] Cached edited translation for UI consistency');
      }
      
      // Always update UI immediately with the edited content (what the user sees)
      onEntryUpdated(editedContent, true);
      setIsProcessing(true);
      
      // Update the database with ONLY the refined text column, preserving transcription text
      const { error: updateError } = await supabase
        .from('Journal Entries')
        .update({ 
          "refined text": contentToSave, // Only update refined text with English content
          "Edit_Status": 1
        })
        .eq('id', entryId);
        
      if (updateError) {
        console.error("Error updating entry:", updateError);
        await showTranslatedToast(
          'toasts.error',
          'toasts.entryUpdateFailed',
          translate
        );
        onEntryUpdated(content, false);
        setIsProcessing(false);
        setIsSubmitting(false);
        return;
      }

      // Set updated flag and keep dialog open briefly
      setUpdatedInBackground(true);
      
      // Trigger immediate entry refresh with updated content
      console.log('[EditEntryButton] Triggering entry update event');
      window.dispatchEvent(new CustomEvent('journalEntryUpdated', {
        detail: { 
          entryId: entryId,
          newContent: contentToSave, // English content for processing
          displayContent: editedContent, // User's edited content for display
          isProcessing: true
        }
      }));
      
      try {
        // Always reprocess since we changed the English content - fix the function call
        const success = await reprocessJournalEntry(entryId, contentToSave);
        
        if (!success) {
          console.error('Reprocessing failed for entry:', entryId);
          await showTranslatedToast(
            'toasts.error',
            'toasts.processingError',
            translate
          );
        }
        
        // Immediately emit event to hide loader cards for smoother transition
        console.log('[EditEntryButton] Entry data ready, signaling immediate loader cleanup');
        window.dispatchEvent(new CustomEvent('journalEntryDataReady', {
          detail: { 
            entryId: entryId,
            action: 'edit-complete'
          }
        }));
        
        // Ensure minimum processing time for UX consistency
        const minProcessingTime = 1000;
        await new Promise(resolve => setTimeout(resolve, minProcessingTime));
        
        // Trigger final refresh to get updated analysis data
        console.log('[EditEntryButton] Triggering final refresh for updated entry');
        window.dispatchEvent(new CustomEvent('journalEntriesNeedRefresh', {
          detail: { 
            action: 'update',
            entryId: entryId,
            force: true
          }
        }));
        
        // Close dialog and update UI
        setIsDialogOpen(false);
        setIsSubmitting(false);
        setIsProcessing(false);
        
        await showTranslatedToast(
          'toasts.success',
          'toasts.entryUpdated',
          translate
        );
        
      } catch (processingError) {
        console.error('Processing failed:', processingError);
        await showTranslatedToast(
          'toasts.error',
          'toasts.processingError',
          translate
        );
        setIsDialogOpen(false);
        setIsSubmitting(false);
        setIsProcessing(false);
      }
      
    } catch (error) {
      console.error('Error updating journal entry:', error);
      await showTranslatedToast(
        'toasts.error',
        'toasts.entryUpdateFailed',
        translate
      );
      setIsSubmitting(false);
      setIsProcessing(false);
    }
  };

  // Check if content has actually changed
  const hasContentChanged = React.useMemo(() => {
    if (currentLanguage === 'en') {
      return editedContent !== content;
    } else {
      // For non-English, check if the translation has changed from cached version
      const cachedTranslation = getCachedTranslation(content);
      return editedContent !== (cachedTranslation || content);
    }
  }, [editedContent, content, currentLanguage, getCachedTranslation]);

  const isAnyLoading = isLoadingTranslation || isTranslatingForSave;

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
        <DialogContent className={cn(
          // Mobile-first responsive width constraints
          "w-[95vw] max-w-[95vw] sm:max-w-sm md:max-w-lg mx-auto",
          // Better mobile positioning and spacing
          "max-h-[90vh] overflow-y-auto p-4 sm:p-6",
          // Ensure proper text wrapping
          "break-words"
        )}>
          <DialogHeader className="space-y-2">
            <DialogTitle className={cn(
              // Responsive text sizing with language awareness
              "text-base sm:text-lg font-semibold leading-tight",
              // Ensure proper text wrapping
              "whitespace-normal break-words hyphens-auto",
              // Language-aware responsive sizing
              currentLanguage !== 'en' && "text-sm sm:text-base"
            )}>
              <EnhancedTranslatableText 
                text="Edit Journal Entry" 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="compact"
              />
            </DialogTitle>
          </DialogHeader>
          
          {isAnyLoading ? (
            <div className="flex items-center justify-center min-h-[200px] py-8">
              <div className="flex flex-col items-center space-y-3">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className={cn(
                  "text-sm text-center",
                  currentLanguage !== 'en' && "text-xs"
                )}>
                  <EnhancedTranslatableText 
                    text={isTranslatingForSave ? "Preparing to save..." : "Loading translation..."} 
                    forceTranslate={true}
                    enableFontScaling={true}
                    scalingContext="compact"
                  />
                </span>
              </div>
            </div>
          ) : (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className={cn(
                "min-h-[180px] sm:min-h-[200px] mt-2 resize-none",
                // Language-aware text sizing
                currentLanguage !== 'en' && "text-sm leading-relaxed"
              )}
              placeholder={currentLanguage === 'en' ? "Edit your journal entry..." : undefined}
              disabled={isSubmitting}
            />
          )}
          
          <DialogFooter className={cn(
            // Responsive layout: stack on mobile, row on larger screens
            "flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 sm:justify-end mt-4",
            // Ensure buttons don't overflow
            "w-full"
          )}>
            <Button 
              variant="outline" 
              onClick={handleCloseDialog}
              disabled={isSubmitting}
              className={cn(
                "rounded-full w-full sm:w-auto",
                // Mobile-optimized button sizing
                "h-10 px-4 text-sm",
                // Language-aware text sizing
                currentLanguage !== 'en' && "text-xs sm:text-sm px-3"
              )}
            >
              <span className="truncate">
                <EnhancedTranslatableText 
                  text="Cancel" 
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="compact"
                />
              </span>
            </Button>
            {isSubmitting ? (
              <Button 
                disabled
                className={cn(
                  "rounded-full w-full sm:w-auto",
                  "h-10 px-4 text-sm",
                  currentLanguage !== 'en' && "text-xs sm:text-sm px-3"
                )}
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
                <span className="truncate">
                  {updatedInBackground ? (
                    <EnhancedTranslatableText 
                      text="Processing..." 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="compact"
                    />
                  ) : (
                    <EnhancedTranslatableText 
                      text="Saving..." 
                      forceTranslate={true}
                      enableFontScaling={true}
                      scalingContext="compact"
                    />
                  )}
                </span>
              </Button>
            ) : (
              <Button 
                onClick={handleSaveChanges}
                disabled={!editedContent.trim() || !hasContentChanged || isAnyLoading}
                className={cn(
                  "rounded-full w-full sm:w-auto",
                  "h-10 px-4 text-sm",
                  currentLanguage !== 'en' && "text-xs sm:text-sm px-3"
                )}
              >
                <span className="truncate">
                  <EnhancedTranslatableText 
                    text="Save Changes" 
                    forceTranslate={true}
                    enableFontScaling={true}
                    scalingContext="compact"
                  />
                </span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default EditEntryButton;
