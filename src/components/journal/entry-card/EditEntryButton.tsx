
import React, { useState, useEffect } from 'react';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { triggerFullTextProcessing } from '@/utils/audio/theme-extractor';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff } from 'lucide-react';

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
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'slow' | null>(null);
  const isMobile = useIsMobile();

  // Ensure minimum processing time for consistent UX
  const MIN_PROCESSING_TIME = 2000; // 2 seconds minimum
  const MAX_PROCESSING_TIME = 15000; // 15 seconds maximum before closing dialog anyway

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial network check
    setNetworkStatus(navigator.onLine ? 'online' : 'offline');
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  useEffect(() => {
    let processingTimer: NodeJS.Timeout | null = null;
    let maxProcessingTimer: NodeJS.Timeout | null = null;
    
    // If processing has started, set up timers
    if (isProcessing && processingStartTime) {
      // Calculate how much time has passed since processing started
      const timePassed = Date.now() - processingStartTime;
      
      // If we haven't reached minimum processing time, set a timer for the remaining time
      if (timePassed < MIN_PROCESSING_TIME) {
        const timeRemaining = MIN_PROCESSING_TIME - timePassed;
        processingTimer = setTimeout(() => {
          // Only close if still processing after timer completes
          if (isProcessing && isDialogOpen) {
            console.log('Minimum processing time reached, closing dialog');
            setIsDialogOpen(false);
            setIsSubmitting(false);
            setIsProcessing(false);
          }
        }, timeRemaining);
      }
      
      // Also set a maximum processing time limit
      maxProcessingTimer = setTimeout(() => {
        if (isProcessing && isDialogOpen) {
          console.log('Maximum processing time reached, closing dialog anyway');
          setIsDialogOpen(false);
          setIsSubmitting(false);
          setIsProcessing(false);
          toast.success('Entry updated (still processing in background)');
        }
      }, MAX_PROCESSING_TIME);
    }
    
    // Clean up timers on unmount or when processing state changes
    return () => {
      if (processingTimer) clearTimeout(processingTimer);
      if (maxProcessingTimer) clearTimeout(maxProcessingTimer);
    };
  }, [isProcessing, processingStartTime, isDialogOpen]);

  const handleOpenDialog = () => {
    setEditedContent(content);
    setIsDialogOpen(true);
    setUpdatedInBackground(false);
    setNetworkStatus(navigator.onLine ? 'online' : 'offline');
  };

  const handleCloseDialog = () => {
    if (!isSubmitting) {
      setIsDialogOpen(false);
    }
  };

  const checkNetworkSpeed = async (): Promise<boolean> => {
    try {
      const startTime = Date.now();
      const response = await fetch('https://www.google.com/favicon.ico', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // If it takes more than 2 seconds to fetch a tiny favicon, network is slow
      const isNetworkSlow = duration > 2000;
      
      if (isNetworkSlow) {
        setNetworkStatus('slow');
        return false;
      }
      
      setNetworkStatus('online');
      return true;
    } catch (error) {
      console.error('Network check failed:', error);
      setNetworkStatus('offline');
      return false;
    }
  };

  const handleSaveChanges = async () => {
    if (!editedContent.trim() || editedContent === content) {
      handleCloseDialog();
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Check network status before proceeding
      const networkGood = await checkNetworkSpeed();
      if (!networkGood) {
        if (networkStatus === 'offline') {
          toast.error("You're offline. Please check your internet connection.");
          setIsSubmitting(false);
          return;
        } else if (networkStatus === 'slow') {
          toast.warning("Your network connection is slow. This might take longer than usual.");
        }
      }
      
      const originalContent = content;
      const newContent = editedContent;
      
      // Update UI with processing state IMMEDIATELY but keep dialog open
      onEntryUpdated(newContent, true);
      setIsProcessing(true);
      setProcessingStartTime(Date.now());
      
      // Add retry logic for network issues
      let retryCount = 0;
      const maxRetries = 3;
      let updateSuccess = false;
      
      while (retryCount < maxRetries && !updateSuccess) {
        try {
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
            retryCount++;
            console.error(`Error updating entry (attempt ${retryCount}):`, updateError);
            
            if (retryCount >= maxRetries) {
              throw updateError;
            }
            
            // Wait with exponential backoff before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          } else {
            updateSuccess = true;
          }
        } catch (err) {
          retryCount++;
          console.error(`Network error during update (attempt ${retryCount}):`, err);
          
          if (retryCount >= maxRetries) {
            throw err;
          }
          
          // Wait with exponential backoff before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        }
      }
      
      if (!updateSuccess) {
        throw new Error("Failed to update entry after multiple attempts");
      }

      // Set updated flag and keep dialog open briefly
      setUpdatedInBackground(true);
      
      try {
        // Process with retry logic
        let processingSuccess = false;
        retryCount = 0;
        
        while (retryCount < maxRetries && !processingSuccess) {
          try {
            await triggerFullTextProcessing(entryId);
            processingSuccess = true;
          } catch (err) {
            retryCount++;
            console.error(`Processing error (attempt ${retryCount}):`, err);
            
            if (retryCount >= maxRetries) {
              throw err;
            }
            
            // Wait with exponential backoff before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          }
        }
        
        // Ensure minimum processing time for UX consistency
        const processingElapsed = Date.now() - (processingStartTime || Date.now());
        if (processingElapsed < MIN_PROCESSING_TIME) {
          await new Promise(resolve => setTimeout(resolve, MIN_PROCESSING_TIME - processingElapsed));
        }
        
        // Dialog close is now handled by the useEffect
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
      
      if (networkStatus === 'offline' || !navigator.onLine) {
        toast.error("Facing network issues. Check your internet connection");
      } else {
        toast.error('Failed to update entry');
      }
      
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
      
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        // Only allow closing if not submitting
        if (!isSubmitting) {
          setIsDialogOpen(open);
        }
      }}>
        <DialogContent className="w-[90%] max-w-lg mx-auto">
          <DialogHeader>
            <DialogTitle>Edit Journal Entry</DialogTitle>
          </DialogHeader>
          
          {networkStatus === 'offline' && (
            <Alert variant="destructive" className="mb-4">
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                You appear to be offline. Changes may not save until your connection is restored.
              </AlertDescription>
            </Alert>
          )}
          
          {networkStatus === 'slow' && (
            <Alert variant="warning" className="mb-4">
              <Wifi className="h-4 w-4" />
              <AlertDescription>
                Your network connection seems slow. Saving might take longer than usual.
              </AlertDescription>
            </Alert>
          )}
          
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
