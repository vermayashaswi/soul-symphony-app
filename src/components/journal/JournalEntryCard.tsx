
import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/utils/format-time';
import { Trash2 } from 'lucide-react';
import ThemeBoxes from './ThemeBoxes';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export interface JournalEntry {
  id: number;
  content: string;
  created_at: string;
  audio_url?: string;
  sentiment?: string | {
    sentiment: string;
    score: number;
  };
  themes?: string[];
  master_themes?: string[];
  entities?: {
    text: string;
    type: string;
    name?: string;
  }[];
  foreignKey?: string;
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onDelete?: (entryId: number) => void;
  isNew?: boolean;
  isProcessing?: boolean;
}

export function JournalEntryCard({ 
  entry, 
  onDelete, 
  isNew = false, 
  isProcessing = false 
}: JournalEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMobile = useIsMobile();
  const [highlightNew, setHighlightNew] = useState(isNew);
  const [isThemesLoading, setIsThemesLoading] = useState(true);
  const [refreshTime, setRefreshTime] = useState(0);
  const [themes, setThemes] = useState<string[]>([]);
  const entryRef = useRef<HTMLDivElement>(null);
  const lastRenderTimeRef = useRef<number>(Date.now());
  const mountedRef = useRef<boolean>(true);
  
  // Log when the component is mounted/unmounted
  useEffect(() => {
    console.log(`[JournalEntryCard] Mounted entry ${entry.id}`);
    mountedRef.current = true;
    
    return () => {
      console.log(`[JournalEntryCard] Unmounted entry ${entry.id}`);
      mountedRef.current = false;
    };
  }, [entry.id]);

  // Auto-expand new entries
  useEffect(() => {
    if (isNew) {
      setIsExpanded(true);
      setHighlightNew(true);
      
      // Remove highlight after 5 seconds
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          setHighlightNew(false);
        }
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isNew]);
  
  // Handle theme loading and extraction
  useEffect(() => {
    if (!mountedRef.current) return;
    
    // Safely extract themes from the entry
    const extractThemes = () => {
      try {
        // Safely access master_themes and themes, providing fallback empty arrays
        const masterThemes = Array.isArray(entry.master_themes) ? entry.master_themes : [];
        const entryThemes = Array.isArray(entry.themes) ? entry.themes : [];
        return masterThemes.length > 0 ? masterThemes : entryThemes;
      } catch (error) {
        console.error("[JournalEntryCard] Error extracting themes:", error);
        return [];
      }
    };
    
    const currentThemes = extractThemes();
    setThemes(currentThemes);
    
    // Determine if themes are still loading
    const shouldBeLoading = isProcessing || (currentThemes.length === 0);
    setIsThemesLoading(shouldBeLoading);
    
    // Set up polling for theme updates if they're loading
    if (shouldBeLoading && entry.id) {
      const pollInterval = setInterval(async () => {
        if (!mountedRef.current) {
          clearInterval(pollInterval);
          return;
        }
        
        try {
          console.log(`[JournalEntryCard] Polling for themes for entry ${entry.id}, attempt ${refreshTime + 1}`);
          
          // Fetch the latest version of the entry
          const { data, error } = await supabase
            .from('Journal Entries')
            .select('master_themes, themes')
            .eq('id', entry.id)
            .single();
            
          if (error) {
            throw error;
          }
          
          // Check if data exists and is not an error
          if (data && typeof data === 'object') {
            // Use type assertion to safely access properties
            const entryData = data as { master_themes?: string[], themes?: string[] };
            
            // Safely extract themes with fallbacks
            const updatedMasterThemes = Array.isArray(entryData.master_themes) ? entryData.master_themes : [];
            const updatedThemes = Array.isArray(entryData.themes) ? entryData.themes : [];
            const updatedCurrentThemes = updatedMasterThemes.length > 0 ? updatedMasterThemes : updatedThemes;
            
            // If we now have themes, update them and stop loading
            if (updatedCurrentThemes.length > 0) {
              console.log(`[JournalEntryCard] Found themes for entry ${entry.id}:`, updatedCurrentThemes);
              
              if (mountedRef.current) {
                setThemes(updatedCurrentThemes);
                setIsThemesLoading(false);
              }
              
              clearInterval(pollInterval);
            }
          }
          
          if (mountedRef.current) {
            setRefreshTime(prev => prev + 1);
          }
          
          // After several attempts, stop showing loading state
          if (refreshTime >= 10) {
            console.log(`[JournalEntryCard] Maximum polling attempts reached for entry ${entry.id}`);
            
            if (mountedRef.current) {
              setIsThemesLoading(false);
            }
            
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error(`[JournalEntryCard] Error polling for themes for entry ${entry.id}:`, error);
          
          // After multiple retries, stop showing loading state
          if (refreshTime > 10) {
            if (mountedRef.current) {
              setIsThemesLoading(false);
            }
            
            clearInterval(pollInterval);
          }
        }
      }, 3000); // Poll every 3 seconds
      
      return () => {
        clearInterval(pollInterval);
      };
    }
  }, [entry.id, entry.master_themes, entry.themes, isProcessing, refreshTime]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleDelete = async () => {
    if (!entry.id) return;
    
    try {
      setIsDeleting(true);
      
      console.log(`[JournalEntryCard] Deleting entry ${entry.id}`);
      
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', entry.id);
        
      if (error) {
        throw error;
      }
      
      console.log(`[JournalEntryCard] Successfully deleted entry ${entry.id}`);
      
      setOpen(false);
      
      // Wrap in setTimeout to ensure this component unmounts cleanly before deletion handler runs
      setTimeout(() => {
        if (onDelete) {
          onDelete(entry.id);
        }
      }, 0);
      
      toast.success('Journal entry deleted');
    } catch (error) {
      console.error('[JournalEntryCard] Error deleting journal entry:', error);
      setIsDeleting(false);
      toast.error('Failed to delete entry');
    }
  };

  const createdAtFormatted = formatRelativeTime(entry.created_at);

  const getSentimentScore = (): number => {
    if (typeof entry.sentiment === 'string') {
      return parseFloat(entry.sentiment);
    } else if (entry.sentiment) {
      return entry.sentiment.score;
    }
    return 0;
  };

  const getSentimentEmoji = () => {
    const score = getSentimentScore();
    
    if (score >= 0.3) {
      return <span role="img" aria-label="positive sentiment" className="text-2xl" style={{ color: '#4ade80' }}>😊</span>;
    } else if (score >= -0.1) {
      return <span role="img" aria-label="neutral sentiment" className="text-2xl" style={{ color: '#facc15' }}>😐</span>;
    } else {
      return <span role="img" aria-label="negative sentiment" className="text-2xl" style={{ color: '#ef4444' }}>😔</span>;
    }
  };

  const FloatingDotsToggle = () => (
    <motion.div 
      className="relative w-8 h-8 cursor-pointer"
      onClick={toggleExpanded}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      {[0, 1, 2].map((i) => {
        const colors = [
          'bg-gradient-to-r from-blue-500 to-purple-500',
          'bg-gradient-to-r from-pink-500 to-orange-400',
          'bg-gradient-to-r from-green-400 to-cyan-500',
        ];
        
        const positions = [
          { x: 0, y: -6 },
          { x: -5, y: 4 },
          { x: 5, y: 4 },
        ];
        
        return (
          <motion.div
            key={i}
            className={`absolute w-2 h-2 rounded-full ${colors[i]}`}
            style={{ 
              left: '50%',
              top: '50%',
              x: positions[i].x,
              y: positions[i].y,
            }}
            animate={{
              y: [
                positions[i].y, 
                positions[i].y - 3, 
                positions[i].y
              ],
              boxShadow: [
                '0 0 2px rgba(255, 255, 255, 0.5)',
                '0 0 6px rgba(255, 255, 255, 0.8)',
                '0 0 2px rgba(255, 255, 255, 0.5)',
              ],
              scale: [1, 1.2, 1],
            }}
            transition={{
              y: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.3,
                repeatType: "mirror"
              },
              boxShadow: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.3
              },
              scale: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.3,
                repeatType: "mirror"
              }
            }}
          />
        );
      })}
      
      <motion.div 
        className="absolute top-1/2 left-1/2 w-5 h-5 rounded-full bg-gradient-to-br from-gray-200/30 to-gray-300/10"
        style={{ transform: 'translate(-50%, -50%)' }}
        animate={{ 
          scale: [0.8, 1.1, 0.8],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </motion.div>
  );

  // Calculate time since last render to detect performance issues
  const now = Date.now();
  const timeSinceLastRender = now - lastRenderTimeRef.current;
  lastRenderTimeRef.current = now;
  
  // Log slow renders
  if (timeSinceLastRender > 100) {
    console.log(`[JournalEntryCard] Slow render for entry ${entry.id}: ${timeSinceLastRender}ms`);
  }

  return (
    <motion.div
      ref={entryRef}
      initial={isNew ? { borderColor: 'rgba(var(--color-primary), 0.7)' } : {}}
      animate={highlightNew 
        ? { 
            borderColor: ['rgba(var(--color-primary), 0.7)', 'rgba(var(--color-primary), 0)'],
            boxShadow: ['0 0 15px rgba(var(--color-primary), 0.3)', '0 0 0px rgba(var(--color-primary), 0)']
          } 
        : {}}
      transition={{ duration: 3 }}
      className="journal-entry-card" // Add a class for debugging
      data-entry-id={entry.id} // Add data attribute for debugging
    >
      <Card className={`bg-background shadow-md ${highlightNew ? 'border-primary' : ''}`}>
        <div className="flex justify-between items-start p-3 md:p-4">
          <div>
            <h3 className="scroll-m-20 text-base md:text-lg font-semibold tracking-tight">{createdAtFormatted}</h3>
            <div className="mt-1">
              {getSentimentEmoji()}
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-3">
            <FloatingDotsToggle />

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size={isMobile ? "sm" : "icon"} className={isMobile ? "h-8 w-8 p-0" : ""}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] max-w-[90vw]">
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete your journal entry from our
                    servers.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isDeleting}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    variant="destructive" 
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="p-3 md:p-4">
          {isExpanded ? (
            <div>
              <p className="text-xs md:text-sm text-foreground">{entry.content}</p>
              <div className="mt-3 md:mt-4">
                <h4 className="text-xs md:text-sm font-semibold text-foreground">Themes</h4>
                <ThemeBoxes 
                  themes={themes} 
                  isDisturbed={true}
                  isLoading={isThemesLoading} 
                />
              </div>
            </div>
          ) : (
            <p className="text-xs md:text-sm text-foreground line-clamp-3">{entry.content}</p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
