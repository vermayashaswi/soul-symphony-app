import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { JournalEntry } from '@/types/journal';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface JournalEntryCardProps {
  entry: JournalEntry;
  compact?: boolean;
  isProcessing?: boolean;
  isProcessed?: boolean;
  onDelete?: () => Promise<void>;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = ({
  entry,
  compact = false,
  isProcessing = false,
  isProcessed = false,
  onDelete
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const toggleExpand = () => {
    setExpanded(!expanded);
  };
  
  const handleDelete = async () => {
    if (!onDelete) return;
    
    try {
      setIsDeleting(true);
      await onDelete();
    } catch (error) {
      console.error('Error deleting entry:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy • h:mm a');
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  // Get content from various possible fields
  const content = entry.content || entry["refined text"] || entry["transcription text"] || "";
  
  // Get sentiment if available
  const sentiment = entry.sentiment || entry["sentiment analysis"]?.sentiment;
  const sentimentScore = entry["sentiment analysis"]?.score;
  
  // Get emotions if available
  const emotions = entry.emotions || entry["emotion analysis"]?.emotions || [];
  
  // Determine if this is a temporary processing entry
  const isTempEntry = Boolean(entry.tempId);
  
  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={cn(
          "overflow-hidden transition-all duration-300",
          isProcessing && "border-primary/30 bg-primary/5",
          isProcessed && "border-green-500/30 bg-green-500/5"
        )}>
          <CardHeader className="py-3 px-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">
                  {isTempEntry ? (
                    <span className="flex items-center">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      <TranslatableText text="Processing..." />
                    </span>
                  ) : (
                    formatDate(entry.created_at)
                  )}
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                {sentiment && !isTempEntry && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      sentiment === "positive" && "bg-green-500/10 text-green-600 border-green-300",
                      sentiment === "negative" && "bg-red-500/10 text-red-600 border-red-300",
                      sentiment === "neutral" && "bg-blue-500/10 text-blue-600 border-blue-300"
                    )}
                  >
                    {sentiment}
                  </Badge>
                )}
                
                {!compact && !isTempEntry && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0" 
                    onClick={toggleExpand}
                  >
                    {expanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                )}
                
                {onDelete && !isTempEntry && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive/80" 
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="px-4 pb-4">
            <div className={cn(
              "text-sm text-foreground",
              compact && "line-clamp-3"
            )}>
              {isTempEntry ? (
                <div className="flex items-center space-x-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-full"></div>
                </div>
              ) : (
                content
              )}
            </div>
            
            {expanded && !compact && !isTempEntry && emotions && emotions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1">
                {emotions.map((emotion: string, index: number) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="text-xs"
                  >
                    {emotion}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <TranslatableText text="Delete Journal Entry" />
            </AlertDialogTitle>
            <AlertDialogDescription>
              <TranslatableText text="Are you sure you want to delete this journal entry? This action cannot be undone." />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              <TranslatableText text="Cancel" />
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              <TranslatableText text="Delete" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default JournalEntryCard;
