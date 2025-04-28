
import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { triggerThemeExtraction } from '@/utils/audio/theme-extractor';

interface ExtractThemeButtonProps {
  entryId: number;
}

export function ExtractThemeButton({ entryId }: ExtractThemeButtonProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const mountedRef = useRef(true);
  const cleanupTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cleanupTimersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Clean any processing cards on mount
  useEffect(() => {
    // Clean processing cards related to this entry on mount
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
        detail: { 
          associatedEntryId: entryId, 
          timestamp: Date.now(),
          forceCleanup: true 
        }
      }));
    }, 100);
    
    cleanupTimersRef.current.push(timer);
    
    return () => {
      clearTimeout(timer);
    };
  }, [entryId]);

  const handleExtractThemes = async () => {
    try {
      setIsExtracting(true);
      
      // Clear any existing timers
      cleanupTimersRef.current.forEach(timer => clearTimeout(timer));
      cleanupTimersRef.current = [];
      
      // Dispatch an event to notify that theme extraction is starting
      window.dispatchEvent(new CustomEvent('themeExtractionStarted', { 
        detail: { entryId }
      }));
      
      // Immediately force clear any processing cards for this entry
      for (let i = 0; i < 3; i++) {
        // Send multiple cleanup events to ensure proper removal
        const timer = setTimeout(() => {
          if (mountedRef.current) {
            window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
              detail: { 
                associatedEntryId: entryId, 
                timestamp: Date.now() + i,
                forceCleanup: true 
              }
            }));
          }
        }, i * 100); // Staggered timing
        
        cleanupTimersRef.current.push(timer);
      }
      
      const success = await triggerThemeExtraction(entryId);
      
      if (success) {
        toast.success('Themes extraction triggered');
        
        // Dispatch event for successful theme extraction
        window.dispatchEvent(new CustomEvent('themeExtractionSucceeded', { 
          detail: { entryId }
        }));
        
        // Force an immediate check for themes with multiple attempts
        for (let i = 0; i < 3; i++) {
          const timer = setTimeout(() => {
            if (mountedRef.current) {
              // Check for themes
              window.dispatchEvent(new CustomEvent('checkForThemesNow', { 
                detail: { entryId }
              }));
              
              // Also dispatch another force removal event
              window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
                detail: { 
                  associatedEntryId: entryId, 
                  timestamp: Date.now() + i,
                  forceCleanup: true 
                }
              }));
              
              // Signal completion
              window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
                detail: { entryId, timestamp: Date.now() + i, forceClearProcessingCard: true }
              }));
            }
          }, 200 + (i * 200));
          
          cleanupTimersRef.current.push(timer);
        }
      } else {
        toast.error('Failed to extract themes');
        
        // Dispatch event for failed theme extraction
        window.dispatchEvent(new CustomEvent('themeExtractionFailed', { 
          detail: { entryId }
        }));
      }
    } catch (error) {
      console.error('Error triggering theme extraction:', error);
      toast.error('Error triggering theme extraction');
      
      // Dispatch event for failed theme extraction with error
      window.dispatchEvent(new CustomEvent('themeExtractionFailed', { 
        detail: { entryId, error }
      }));
    } finally {
      if (mountedRef.current) {
        setIsExtracting(false);
      }
      
      // Always dispatch final cleanup events regardless of success/failure
      for (let i = 0; i < 3; i++) {
        const timer = setTimeout(() => {
          if (mountedRef.current) {
            window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
              detail: { entryId, timestamp: Date.now() + i, forceClearProcessingCard: true }
            }));
            
            window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
              detail: { 
                associatedEntryId: entryId, 
                timestamp: Date.now() + i,
                forceCleanup: true 
              }
            }));
          }
        }, 300 + (i * 200));
        
        cleanupTimersRef.current.push(timer);
      }
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={handleExtractThemes}
      disabled={isExtracting}
      className="mt-2 w-full bg-background hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isExtracting ? 'animate-spin' : ''}`} />
      {isExtracting ? 'Extracting...' : 'Refresh Themes'}
    </Button>
  );
}

export default ExtractThemeButton;
