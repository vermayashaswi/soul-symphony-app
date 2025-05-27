
import React from 'react';
import { JournalEntry } from '@/types/journal';
import { Card, CardContent } from '@/components/ui/card';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Badge } from '@/components/ui/badge';
import { Heart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface SampleEntryCardProps {
  entry: JournalEntry;
  onStartRecording: () => void;
}

export function SampleEntryCard({ entry, onStartRecording }: SampleEntryCardProps) {
  return (
    <Card className="w-full mb-4 border-dashed border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-2 right-2 opacity-20">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <div className="absolute bottom-2 left-2 opacity-10">
        <Heart className="h-8 w-8 text-primary" />
      </div>
      
      <CardContent className="p-6">
        {/* Header with timestamp */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
            <span className="text-sm text-muted-foreground">
              <TranslatableText text="Sample Entry" forceTranslate={true} />
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Main content */}
        <div className="mb-4">
          <p className="text-foreground leading-relaxed">
            <TranslatableText 
              text={entry.content} 
              forceTranslate={true}
            />
          </p>
        </div>

        {/* Sentiment indicator */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-muted-foreground">
              <TranslatableText text="Positive" forceTranslate={true} />
            </span>
          </div>
        </div>

        {/* Themes */}
        {entry.themes && entry.themes.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {entry.themes.map((theme, index) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  #{theme}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Call to action */}
        <div className="pt-4 border-t border-muted-foreground/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground text-center sm:text-left">
              <TranslatableText 
                text="Ready to start your journaling journey?" 
                forceTranslate={true} 
              />
            </p>
            <Button 
              onClick={onStartRecording}
              className="rounded-full px-6 py-2 bg-primary hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <TranslatableText 
                text="Start Recording" 
                forceTranslate={true} 
              />
            </Button>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-4 pt-3 border-t border-muted-foreground/10">
          <p className="text-xs text-muted-foreground/70 text-center">
            <TranslatableText 
              text="This is a sample entry. It will disappear once you create your first real entry." 
              forceTranslate={true} 
            />
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default SampleEntryCard;
