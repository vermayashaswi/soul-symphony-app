
import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, MessageSquare, Clock, Volume } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AudioPlayer } from '@/components/AudioPlayer';

interface JournalEntry {
  id: number;
  'transcription text': string;
  'refined text'?: string;
  sentiment?: string;
  emotions?: Record<string, number>;
  master_themes?: string[];
  created_at: string;
  duration?: number;
  audio_url?: string;
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  isSelected?: boolean;
  onClick?: () => void;
  onChatClick?: () => void;
  isProcessing?: boolean;
}

export function JournalEntryCard({ 
  entry, 
  isSelected = false,
  onClick,
  onChatClick,
  isProcessing = false
}: JournalEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAudio, setShowAudio] = useState(false);

  const formattedDate = format(new Date(entry.created_at), 'MMM d, yyyy');
  const timeAgo = formatDistanceToNow(new Date(entry.created_at), { addSuffix: true });
  
  const displayText = entry['refined text'] || entry['transcription text'] || '';
  const truncatedText = !isExpanded && displayText.length > 300 
    ? displayText.substring(0, 300) + '...'
    : displayText;
    
  const hasAudio = !!entry.audio_url;
  
  return (
    <Card 
      className={cn(
        "transition-all hover:shadow-md cursor-pointer",
        isSelected && "border-primary ring-1 ring-primary"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-medium">{formattedDate}</CardTitle>
          <div className="flex gap-1">
            {entry.sentiment && (
              <Badge variant="outline" className="capitalize">
                {entry.sentiment}
              </Badge>
            )}
            {isProcessing && (
              <Badge variant="secondary" className="animate-pulse">
                Processing
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center text-sm text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 mr-1" />
          <span>{timeAgo}</span>
          
          {entry.duration && (
            <>
              <Clock className="h-3.5 w-3.5 ml-3 mr-1" />
              <span>{Math.round(entry.duration / 60)} mins</span>
            </>
          )}
          
          {hasAudio && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 ml-2" 
              onClick={(e) => {
                e.stopPropagation();
                setShowAudio(!showAudio);
              }}
            >
              <Volume className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pb-3">
        <p className="text-sm whitespace-pre-wrap">
          {truncatedText}
        </p>
        
        {displayText.length > 300 && (
          <Button
            variant="link"
            className="p-0 h-auto text-xs mt-1"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? 'Show less' : 'Read more'}
          </Button>
        )}
        
        {showAudio && hasAudio && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <AudioPlayer audioUrl={entry.audio_url} />
          </div>
        )}
        
        {entry.master_themes && entry.master_themes.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-3">
            {entry.master_themes.map(theme => (
              <Badge key={theme} variant="secondary" className="text-xs">
                {theme}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-0">
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-auto"
          onClick={(e) => {
            e.stopPropagation();
            if (onChatClick) onChatClick();
          }}
        >
          <MessageSquare className="h-3.5 w-3.5 mr-1" />
          Chat about this
        </Button>
      </CardFooter>
    </Card>
  );
}

// Add default export for compatibility with existing imports
export default JournalEntryCard;
