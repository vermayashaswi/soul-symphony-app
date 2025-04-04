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
}

export function JournalEntryCard({ entry, onDelete }: JournalEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
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
      
      const { error } = await supabase
        .from('Journal Entries')
        .delete()
        .eq('id', entry.id);
        
      if (error) {
        throw error;
      }
      
      setOpen(false);
      
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
            {entry.themes && entry.themes.length > 0 && (
              <div className="mt-3 md:mt-4">
                <h4 className="text-xs md:text-sm font-semibold text-foreground">Themes</h4>
                <ThemeBoxes themes={entry.themes} isDisturbed={true} />
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
