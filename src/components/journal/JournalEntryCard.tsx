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

  // New Funky Colorful Animation Toggle Component
  const FunkyToggle = () => (
    <motion.div 
      className="relative w-8 h-8 cursor-pointer group"
      onClick={toggleExpanded}
      whileHover={{ scale: 1.1 }}
    >
      {/* Center particle */}
      <motion.div 
        className="absolute top-1/2 left-1/2 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-purple-400 to-pink-500"
        style={{ transform: 'translate(-50%, -50%)' }}
        animate={{ 
          scale: [1, 1.3, 1],
          boxShadow: [
            '0 0 0px rgba(192, 132, 252, 0.5)',
            '0 0 10px rgba(192, 132, 252, 0.8)',
            '0 0 0px rgba(192, 132, 252, 0.5)',
          ]
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* Orbiting colorful particles */}
      {[0, 1, 2].map((i) => {
        const colors = [
          'bg-gradient-to-r from-pink-500 to-orange-400',
          'bg-gradient-to-r from-green-400 to-cyan-500',
          'bg-gradient-to-r from-purple-500 to-indigo-500'
        ];
        
        return (
          <motion.div
            key={i}
            className={`absolute w-2 h-2 rounded-full ${colors[i]}`}
            style={{ 
              top: '50%', 
              left: '50%',
              originX: '0',
              originY: '0',
            }}
            animate={{
              rotate: isExpanded ? [i * 120, i * 120 + 360] : [i * 120 + 360, i * 120],
              scale: [1, 1.2, 1],
            }}
            transition={{
              rotate: {
                duration: 3 + i * 0.5,
                repeat: Infinity,
                repeatType: "loop",
                ease: "linear"
              },
              scale: {
                duration: 2,
                repeat: Infinity,
                repeatType: "reverse",
                delay: i * 0.3
              }
            }}
          >
            <motion.div 
              className="w-full h-full rounded-full"
              animate={{
                boxShadow: [
                  '0 0 3px rgba(255, 255, 255, 0.5)',
                  '0 0 8px rgba(255, 255, 255, 0.8)',
                  '0 0 3px rgba(255, 255, 255, 0.5)',
                ],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.5
              }}
            />
          </motion.div>
        );
      })}

      {/* Group hover effect - particle bursts */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={`burst-${i}`}
          className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full bg-white opacity-0 group-hover:opacity-100"
          animate={{
            x: 0,
            y: 0,
            opacity: 0
          }}
          whileHover={{
            x: Math.cos(i * Math.PI / 2) * 30,
            y: Math.sin(i * Math.PI / 2) * 30,
            opacity: [0, 1, 0],
            transition: {
              duration: 0.8,
              repeatDelay: 0.2,
              repeat: Infinity
            }
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
          <FunkyToggle />

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
