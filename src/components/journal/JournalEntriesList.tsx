
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JournalEntryCard, { JournalEntry } from './JournalEntryCard';
import JournalSearch from './JournalSearch';
import EmptyJournalState from './EmptyJournalState';
import { Skeleton } from '@/components/ui/skeleton';
import { Smile, Meh, Frown, Mic, MessagesSquare, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  processingEntries?: string[]; // Entries that are currently being processed
  onStartRecording: () => void;
}

const JournalEntriesList: React.FC<JournalEntriesListProps> = ({ 
  entries, 
  loading,
  processingEntries = [],
  onStartRecording
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter entries based on the search query
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) {
      return entries;
    }
    
    const query = searchQuery.toLowerCase().trim();
    
    return entries.filter(entry => {
      // Check in entity names
      if (entry.entities && entry.entities.length > 0) {
        const hasMatchingEntity = entry.entities.some(entity => 
          entity.name.toLowerCase().includes(query)
        );
        if (hasMatchingEntity) return true;
      }
      
      // Also check in the text content
      if (entry["refined text"] && 
          entry["refined text"].toLowerCase().includes(query)) {
        return true;
      }
      
      // Check themes if available
      if (entry.master_themes && 
          entry.master_themes.some(theme => theme.toLowerCase().includes(query))) {
        return true;
      }
      
      return false;
    });
  }, [entries, searchQuery]);

  // Helper function to get sentiment emoji based on score
  const getSentimentEmoji = (sentiment?: string) => {
    if (!sentiment) return <Meh className="h-6 w-6 text-gray-400" aria-label="Neutral sentiment" />;
    
    const score = parseFloat(sentiment);
    if (score > 0.25) return <Smile className="h-6 w-6 text-green-500" aria-label="Positive sentiment" />;
    if (score < -0.25) return <Frown className="h-6 w-6 text-red-500" aria-label="Negative sentiment" />;
    return <Meh className="h-6 w-6 text-amber-500" aria-label="Neutral sentiment" />;
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex justify-center my-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (entries.length === 0 && processingEntries.length === 0) {
    return (
      <div className="space-y-8">
        <EmptyJournalState onStartRecording={onStartRecording} />
        
        <div className="p-6 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/50">
          <h3 className="text-lg font-medium mb-2 flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-amber-500" />
            Chat with your journal
          </h3>
          <p className="text-muted-foreground mb-4">
            Once you've created journal entries, you can use the Smart Chat to ask questions like:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5 mb-4">
            <li>"What were my top 3 emotions last week?"</li>
            <li>"How did I feel about work recently?"</li>
            <li>"What themes keep appearing in my journal?"</li>
            <li>"When was I feeling most stressed and why?"</li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => window.location.href = "/smart-chat"} 
              className="mt-2" 
              variant="outline"
              disabled={entries.length === 0}
            >
              <MessagesSquare className="mr-2 h-4 w-4" />
              Go to Smart Chat
            </Button>
            <Button
              onClick={onStartRecording}
              className="mt-2"
              variant="default"
            >
              <Mic className="mr-2 h-4 w-4" />
              Record First Entry
            </Button>
          </div>
          
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
            <h4 className="font-medium mb-1 flex items-center">
              <ArrowRight className="h-4 w-4 mr-1 flex-shrink-0" />
              How Smart Chat Works
            </h4>
            <p className="text-sm">
              Smart Chat analyzes your journal entries to provide insights about your emotions, 
              experiences, and patterns. The more journal entries you create, the more accurate and 
              helpful the insights will be.
            </p>
            <p className="text-sm mt-2">
              For optimal results, try to journal regularly about your daily experiences, emotions, 
              and thoughts. This helps Smart Chat understand your emotional patterns and provide
              meaningful responses.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const noSearchResults = searchQuery.trim() !== '' && filteredEntries.length === 0;

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ staggerChildren: 0.1 }}
    >
      <JournalSearch onSearch={setSearchQuery} />
      
      {noSearchResults && (
        <motion.div 
          className="text-center py-8 bg-muted/30 rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-muted-foreground">No entries found matching "{searchQuery}"</p>
          <button 
            onClick={() => setSearchQuery('')}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Clear search
          </button>
        </motion.div>
      )}
      
      <AnimatePresence>
        {/* Processing entry placeholders */}
        {processingEntries.map((tempId) => (
          <motion.div 
            key={tempId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border rounded-lg p-6 shadow-sm relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div className="w-2/3">
                <Skeleton className="h-7 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="h-20 w-20 rounded-md" />
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span>Processing your journal entry with AI...</span>
            </div>
          </motion.div>
        ))}

        {/* Actual entries */}
        {filteredEntries.map((entry) => (
          <JournalEntryCard key={entry.id} entry={entry} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

export default JournalEntriesList;
