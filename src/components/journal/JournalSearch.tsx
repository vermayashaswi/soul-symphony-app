
import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { JournalEntry } from './JournalEntryCard';
import { Search } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface JournalSearchProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
  onSearchResults: (filteredEntries: JournalEntry[]) => void;
}

const searchPrompts = [
  "emotions",
  "memories",
  "places",
  "people",
  "thoughts",
  "events",
  "feelings",
  "themes",
  "issues",
  "entities"
];

const JournalSearch: React.FC<JournalSearchProps> = ({ entries, onSelectEntry, onSearchResults }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [typingPlaceholder, setTypingPlaceholder] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [typingIndex, setTypingIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const totalEntriesCount = entries.length;

  // Set up the typing animation for the placeholder text
  useEffect(() => {
    if (isTyping) {
      const currentWord = searchPrompts[placeholderIndex];
      
      if (typingIndex < currentWord.length) {
        // Typing phase
        const typingTimeout = setTimeout(() => {
          setTypingPlaceholder(currentWord.substring(0, typingIndex + 1));
          setTypingIndex(typingIndex + 1);
        }, 100); // Speed of typing
        
        return () => clearTimeout(typingTimeout);
      } else {
        // Word is fully typed, pause before erasing
        const pauseTimeout = setTimeout(() => {
          setIsTyping(false);
        }, 1500); // Pause with full word
        
        return () => clearTimeout(pauseTimeout);
      }
    } else {
      // Erasing phase
      if (typingIndex > 0) {
        const erasingTimeout = setTimeout(() => {
          setTypingPlaceholder(searchPrompts[placeholderIndex].substring(0, typingIndex - 1));
          setTypingIndex(typingIndex - 1);
        }, 60); // Speed of erasing (slightly faster than typing)
        
        return () => clearTimeout(erasingTimeout);
      } else {
        // Word is fully erased, move to next word
        const nextWordTimeout = setTimeout(() => {
          setPlaceholderIndex((prevIndex) => (prevIndex + 1) % searchPrompts.length);
          setIsTyping(true);
        }, 300); // Pause before starting next word
        
        return () => clearTimeout(nextWordTimeout);
      }
    }
  }, [isTyping, typingIndex, placeholderIndex]);

  // Handle search functionality
  useEffect(() => {
    // When search query is empty, use all entries
    if (!searchQuery.trim()) {
      setFilteredEntries(entries);
      onSearchResults(entries);
      return;
    }

    const filtered = entries.filter(entry => {
      const content = (entry.content || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      
      // Check content for match
      if (content.includes(query)) return true;
      
      // Check entities for match
      if (entry.entities) {
        try {
          // Entities are usually stored as JSON
          const entityData = typeof entry.entities === 'string' 
            ? JSON.parse(entry.entities) 
            : entry.entities;
          
          // Check if any entity matches the search query
          if (entityData && Array.isArray(entityData)) {
            return entityData.some(entity => 
              entity.name?.toLowerCase().includes(query) || 
              entity.type?.toLowerCase().includes(query)
            );
          } else if (entityData && typeof entityData === 'object') {
            // Handle case where entities might be an object
            return Object.values(entityData).some(value => 
              value && String(value).toLowerCase().includes(query)
            );
          }
        } catch (e) {
          console.error("Error parsing entities:", e);
        }
      }
      
      // Check themes for match - use both themes and master_themes for compatibility
      if (entry.themes && Array.isArray(entry.themes)) {
        return entry.themes.some(theme => 
          theme.toLowerCase().includes(query)
        );
      }
      
      // Also check master_themes if themes is not available
      if (entry.master_themes && Array.isArray(entry.master_themes)) {
        return entry.master_themes.some(theme => 
          theme.toLowerCase().includes(query)
        );
      }
      
      return false;
    });

    setFilteredEntries(filtered);
    onSearchResults(filtered); // Pass filtered entries back to parent
  }, [searchQuery, entries, onSearchResults]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
  };

  const handleEntrySelect = (entry: JournalEntry) => {
    onSelectEntry(entry);
  };

  const displayedCount = searchQuery.trim() ? filteredEntries.length : entries.length;

  return (
    <Card className="w-full sticky top-0 z-10 bg-background shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-col space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={`Search for ${typingPlaceholder}${isTyping ? '|' : ''}`}
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground ml-auto">
              {totalEntriesCount} total {totalEntriesCount === 1 ? 'entry' : 'entries'}
            </div>
          </div>

          {searchQuery.trim() && (
            <div className="pt-2">
              {displayedCount > 0 ? (
                <Badge variant="secondary" className="mb-2">
                  {displayedCount} {displayedCount === 1 ? 'entry' : 'entries'} found
                </Badge>
              ) : (
                <div className="text-muted-foreground">No entries found.</div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default JournalSearch;
