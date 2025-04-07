
import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { JournalEntry } from './JournalEntryCard';
import { Search } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import DateRangeFilter from './DateRangeFilter';

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
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dateFilteredEntries, setDateFilteredEntries] = useState<JournalEntry[]>([]);
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);

  // Set up the animation for the placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setShowPlaceholder(false);
      setTimeout(() => {
        setPlaceholderIndex((prevIndex) => (prevIndex + 1) % searchPrompts.length);
        setShowPlaceholder(true);
      }, 500); // Time for fade out before changing text
    }, 3000); // Change text every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // Handle search functionality with date filter integration
  useEffect(() => {
    // Base data to filter from
    const dataToFilter = isDateFilterActive ? dateFilteredEntries : entries;
    
    // When search query is empty, use the date filtered results or all entries
    if (!searchQuery.trim()) {
      setFilteredEntries(dataToFilter);
      onSearchResults(dataToFilter);
      return;
    }

    const filtered = dataToFilter.filter(entry => {
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
  }, [searchQuery, entries, onSearchResults, isDateFilterActive, dateFilteredEntries]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
  };

  const handleEntrySelect = (entry: JournalEntry) => {
    onSelectEntry(entry);
  };

  // Handle date filter change
  const handleDateFilterChange = (filteredByDate: JournalEntry[]) => {
    setDateFilteredEntries(filteredByDate);
    
    // If there's an active search, apply it to the date-filtered results
    if (searchQuery.trim()) {
      const searchFiltered = filteredByDate.filter(entry => {
        const content = (entry.content || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return content.includes(query);
      });
      
      setFilteredEntries(searchFiltered);
      onSearchResults(searchFiltered);
    } else {
      // If no search, just use the date-filtered results
      setFilteredEntries(filteredByDate);
      onSearchResults(filteredByDate);
    }
  };

  // Handle date filter active state
  const handleDateFilterActive = (isActive: boolean) => {
    setIsDateFilterActive(isActive);
    if (!isActive) {
      // Reset to just search results when date filter is cleared
      if (searchQuery.trim()) {
        const searchFiltered = entries.filter(entry => {
          const content = (entry.content || '').toLowerCase();
          const query = searchQuery.toLowerCase();
          return content.includes(query);
        });
        
        setFilteredEntries(searchFiltered);
        onSearchResults(searchFiltered);
      } else {
        // No search, no date filter, show all entries
        setFilteredEntries(entries);
        onSearchResults(entries);
      }
    }
  };

  const totalEntriesCount = entries.length;
  const displayedCount = isDateFilterActive || searchQuery.trim() ? filteredEntries.length : entries.length;

  return (
    <Card className="w-full sticky top-0 z-10 bg-background shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-col space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={showPlaceholder ? `Search for ${searchPrompts[placeholderIndex]}...` : "Search journal entries..."}
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <DateRangeFilter 
              entries={entries}
              onFilterChange={handleDateFilterChange}
              onFilterActive={handleDateFilterActive}
            />
            
            <div className="text-sm text-muted-foreground ml-auto">
              {totalEntriesCount} total {totalEntriesCount === 1 ? 'entry' : 'entries'}
            </div>
          </div>

          {(searchQuery.trim() || isDateFilterActive) && (
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
