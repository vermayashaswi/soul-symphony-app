
import React, { useState } from 'react';
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
  // Update to match database column name
  themes?: string[];
  master_themes?: string[]; // Keep for backward compatibility
  entities?: {
    text: string;
    type: string;
    name?: string; // Added name property for entities
  }[];
  foreignKey?: string;
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onDelete?: (entryId: number) => void;
}

export function JournalEntryCard({ entry, onDelete }: JournalEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false); // Changed to false to collapse by default
  const [open, setOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMobile = useIsMobile();

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleDelete = async () => {
    if (!entry.id) return;
    
    try {
      setIsDeleting(true);
      
      // Delete the entry from the database
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', entry.id);
        
      if (error) {
        throw error;
      }
      
      // Close the dialog
      setOpen(false);
      
      // Call the onDelete callback to update the UI
      if (onDelete) {
        onDelete(entry.id);
      }
      
      toast.success('Journal entry deleted');
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      toast.error('Failed to delete entry');
    } finally {
      setIsDeleting(false);
    }
  };

  const createdAtFormatted = formatRelativeTime(entry.created_at);

  // Get sentiment score
  const getSentimentScore = (): number => {
    if (typeof entry.sentiment === 'string') {
      return parseFloat(entry.sentiment);
    } else if (entry.sentiment) {
      return entry.sentiment.score;
    }
    return 0;
  };

  // Get sentiment emoji with appropriate color
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

  // New Animated Circular Orbit Component to replace the dots
  const OrbitToggle = () => (
    <motion.div 
      className="relative w-8 h-8 cursor-pointer"
      onClick={toggleExpanded}
      whileHover={{ scale: 1.1 }}
    >
      {/* Center dot */}
      <motion.div 
        className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-theme-color"
        style={{ transform: 'translate(-50%, -50%)' }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* Orbiting dots */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{ 
            top: '50%', 
            left: '50%',
            backgroundColor: `hsl(var(--primary-h), var(--primary-s), ${60 + i * 10}%)` 
          }}
          animate={{
            x: Math.cos(i * (2 * Math.PI / 3)) * 12,
            y: Math.sin(i * (2 * Math.PI / 3)) * 12,
            rotate: isExpanded ? [0, 360] : [360, 0],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            repeatType: "loop",
            ease: "linear"
          }}
        />
      ))}
    </motion.div>
  );

  return (
    <Card className="bg-background shadow-md">
      <div className="flex justify-between items-start p-3 md:p-4">
        <div>
          <h3 className="scroll-m-20 text-base md:text-lg font-semibold tracking-tight">{createdAtFormatted}</h3>
          <div className="mt-1">
            {getSentimentEmoji()}
          </div>
        </div>

        <div className="flex items-center space-x-2 md:space-x-3">
          <OrbitToggle />

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
            {entry.themes && entry.themes.length > 0 && (
              <div className="mt-3 md:mt-4">
                <h4 className="text-xs md:text-sm font-semibold text-foreground">Themes</h4>
                <ThemeBoxes themes={entry.themes} />
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs md:text-sm text-foreground line-clamp-3">{entry.content}</p>
        )}
      </div>
    </Card>
  );
}
